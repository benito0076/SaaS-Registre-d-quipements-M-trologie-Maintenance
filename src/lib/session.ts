import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { organizations, users, type UserRole } from "@/db/schema";

/**
 * Contexte de tenant. Toutes les fonctions d'accès aux données (src/server)
 * reçoivent ce contexte et filtrent systématiquement sur `orgId`.
 * L'organisation et le rôle sont relus en base à chaque requête : le jeton
 * de session ne contient que l'identifiant utilisateur, ce qui rend effectif
 * immédiatement un changement de rôle ou une suppression de compte.
 */
export interface TenantContext {
  userId: string;
  orgId: string;
  role: UserRole;
  email: string;
  fullName: string | null;
  orgName: string;
}

export const getCurrentUser = cache(async (): Promise<TenantContext | null> => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;
  const [row] = await db
    .select({
      userId: users.id,
      orgId: users.orgId,
      role: users.role,
      email: users.email,
      fullName: users.fullName,
      orgName: organizations.name,
    })
    .from(users)
    .innerJoin(organizations, eq(organizations.id, users.orgId))
    .where(eq(users.id, userId))
    .limit(1);
  if (!row || !row.orgId) return null;
  return { ...row, orgId: row.orgId, role: row.role ?? "viewer" };
});

/** Pour les pages : redirige vers /login si non connecté. */
export async function requireUser(callbackUrl?: string): Promise<TenantContext> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : "/login");
  }
  return user;
}
