import { sql } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/db/enums";
import type { EquipmentInput } from "@/lib/validation";
import type { Ctx } from "@/server/context";
import { signupOrganization } from "@/server/organizations";

export async function resetDb() {
  await db.execute(
    sql`TRUNCATE alert_dispatches, cron_runs, maintenance_records, equipments, subscriptions, users, organizations CASCADE`,
  );
}

let seq = 0;

/** Crée une organisation et son administrateur ; renvoie le contexte de tenant. */
export async function createOrg(name = "Org"): Promise<Ctx & { email: string }> {
  seq++;
  const email = `admin${seq}-${Date.now()}@example.com`;
  const { orgId, userId } = await signupOrganization({
    companyName: `${name} ${seq}`,
    fullName: `Admin ${seq}`,
    email,
    password: "password-123456",
  });
  return { orgId, userId, role: "admin", email };
}

export async function addUser(orgId: string, role: UserRole): Promise<Ctx & { email: string }> {
  seq++;
  const email = `${role}${seq}-${Date.now()}@example.com`;
  const [u] = await db.insert(users).values({ orgId, email, role, passwordHash: "x" }).returning();
  return { orgId, userId: u.id, role, email };
}

export async function setPlan(orgId: string, planTier: "free" | "pro") {
  await db.update(subscriptions).set({ planTier }).where(eq(subscriptions.orgId, orgId));
}

export function equipmentInput(overrides: Partial<EquipmentInput> = {}): EquipmentInput {
  seq++;
  return {
    internalId: `EQ-TEST-${seq}`,
    name: "Balance de précision",
    brand: "Mettler",
    model: "XS205",
    serialNumber: `SN-${seq}`,
    location: "Labo 1",
    status: "operational",
    calibrationFrequencyMonths: 12,
    lastCalibrationDate: null,
    nextCalibrationDate: "2027-01-15",
    ...overrides,
  };
}
