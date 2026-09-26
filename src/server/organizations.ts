import bcrypt from "bcryptjs";
import { and, asc, count, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { organizations, subscriptions, users, type UserRole } from "@/db/schema";
import { ConflictError, NotFoundError, ValidationError, isUniqueViolation } from "@/lib/errors";
import { assertCan } from "@/lib/permissions";
import { isUuid } from "@/lib/validation";
import type { Ctx } from "./context";

const BCRYPT_ROUNDS = Number(process.env.BCRYPT_ROUNDS ?? 12);
const EMAIL_TAKEN = "Un compte existe déjà avec cet e-mail";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Inscription (§3.A) : crée l'organisation, son administrateur et l'abonnement gratuit. */
export async function signupOrganization(input: {
  companyName: string;
  fullName: string | null;
  email: string;
  password: string;
}) {
  const passwordHash = await hashPassword(input.password);
  try {
    return await db.transaction(async (tx) => {
      const [org] = await tx.insert(organizations).values({ name: input.companyName }).returning();
      const [user] = await tx
        .insert(users)
        .values({
          orgId: org.id,
          email: input.email,
          fullName: input.fullName,
          role: "admin",
          passwordHash,
        })
        .returning({ id: users.id });
      await tx.insert(subscriptions).values({ orgId: org.id, planTier: "free", status: "active" });
      return { orgId: org.id, userId: user.id };
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ConflictError(EMAIL_TAKEN);
    throw e;
  }
}

export async function listTeam(ctx: Ctx) {
  return db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.orgId, ctx.orgId))
    .orderBy(asc(users.createdAt));
}

export async function addTeamMember(
  ctx: Ctx,
  input: { email: string; fullName: string | null; role: UserRole; password: string },
) {
  assertCan(ctx.role, "team:manage");
  const passwordHash = await hashPassword(input.password);
  try {
    const [user] = await db
      .insert(users)
      .values({
        orgId: ctx.orgId,
        email: input.email,
        fullName: input.fullName,
        role: input.role,
        passwordHash,
      })
      .returning({ id: users.id });
    return user;
  } catch (e) {
    if (isUniqueViolation(e)) throw new ConflictError(EMAIL_TAKEN);
    throw e;
  }
}

async function assertAnotherAdminRemains(ctx: Ctx, excludingUserId: string) {
  const [{ value }] = await db
    .select({ value: count() })
    .from(users)
    .where(and(eq(users.orgId, ctx.orgId), eq(users.role, "admin"), ne(users.id, excludingUserId)));
  if (value === 0) {
    throw new ValidationError("L'organisation doit conserver au moins un administrateur");
  }
}

export async function updateTeamMemberRole(ctx: Ctx, userId: string, role: UserRole) {
  assertCan(ctx.role, "team:manage");
  if (!isUuid(userId)) throw new NotFoundError();
  if (role !== "admin") await assertAnotherAdminRemains(ctx, userId);
  const updated = await db
    .update(users)
    .set({ role })
    .where(and(eq(users.id, userId), eq(users.orgId, ctx.orgId)))
    .returning({ id: users.id });
  if (updated.length === 0) throw new NotFoundError();
}

export async function removeTeamMember(ctx: Ctx, userId: string) {
  assertCan(ctx.role, "team:manage");
  if (!isUuid(userId)) throw new NotFoundError();
  if (userId === ctx.userId) throw new ValidationError("Vous ne pouvez pas supprimer votre propre compte");
  await assertAnotherAdminRemains(ctx, userId);
  const deleted = await db
    .delete(users)
    .where(and(eq(users.id, userId), eq(users.orgId, ctx.orgId)))
    .returning({ id: users.id });
  if (deleted.length === 0) throw new NotFoundError();
}
