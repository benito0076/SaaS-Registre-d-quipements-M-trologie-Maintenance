import { and, asc, count, desc, eq, gte, ilike, lt, lte, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  equipments,
  maintenanceRecords,
  organizations,
  subscriptions,
  type Equipment,
  type EquipmentStatus,
  type PlanTier,
} from "@/db/schema";
import { addDays, todayIso } from "@/lib/dates";
import { ConflictError, NotFoundError, PlanLimitError, isUniqueViolation } from "@/lib/errors";
import { assertCan } from "@/lib/permissions";
import { canCreateEquipment, FREE_PLAN_EQUIPMENT_LIMIT } from "@/lib/plan";
import { isUuid, type EquipmentInput } from "@/lib/validation";
import type { Ctx } from "./context";

/**
 * Accès aux équipements. RÈGLE : chaque requête porte la condition
 * `equipments.org_id = ctx.orgId`. Un identifiant appartenant à une autre
 * organisation produit NotFoundError (HTTP 404).
 */

export type EquipmentFilter = "all" | EquipmentStatus | "overdue" | "due_soon";
export type EquipmentSort = "next_calibration_date" | "internal_id" | "name" | "location" | "created_at";

export interface ListOptions {
  q?: string;
  filter?: EquipmentFilter;
  sort?: EquipmentSort;
  dir?: "asc" | "desc";
  today?: string;
}

const SORT_COLUMNS = {
  next_calibration_date: equipments.nextCalibrationDate,
  internal_id: equipments.internalId,
  name: equipments.name,
  location: equipments.location,
  created_at: equipments.createdAt,
} as const;

function escapeLike(v: string): string {
  return v.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function listEquipments(ctx: Ctx, opts: ListOptions = {}): Promise<Equipment[]> {
  const today = opts.today ?? todayIso();
  const conditions: SQL[] = [eq(equipments.orgId, ctx.orgId)];

  const q = opts.q?.trim();
  if (q) {
    const pattern = `%${escapeLike(q)}%`;
    conditions.push(
      or(
        ilike(equipments.internalId, pattern),
        ilike(equipments.name, pattern),
        ilike(equipments.brand, pattern),
        ilike(equipments.model, pattern),
        ilike(equipments.serialNumber, pattern),
        ilike(equipments.location, pattern),
      )!,
    );
  }

  switch (opts.filter) {
    case "operational":
    case "under_maintenance":
    case "out_of_service":
      conditions.push(eq(equipments.status, opts.filter));
      break;
    case "overdue":
      conditions.push(lt(equipments.nextCalibrationDate, today));
      break;
    case "due_soon":
      conditions.push(
        gte(equipments.nextCalibrationDate, today),
        lte(equipments.nextCalibrationDate, addDays(today, 30)),
      );
      break;
  }

  const column = SORT_COLUMNS[opts.sort ?? "next_calibration_date"] ?? equipments.nextCalibrationDate;
  const order = opts.dir === "desc" ? desc(column) : asc(column);

  return db
    .select()
    .from(equipments)
    .where(and(...conditions))
    .orderBy(order, asc(equipments.internalId));
}

export async function getEquipment(ctx: Ctx, id: string): Promise<Equipment> {
  if (!isUuid(id)) throw new NotFoundError();
  const [row] = await db
    .select()
    .from(equipments)
    .where(and(eq(equipments.id, id), eq(equipments.orgId, ctx.orgId)))
    .limit(1);
  if (!row) throw new NotFoundError();
  return row;
}

export interface OrgUsage {
  equipmentCount: number;
  planTier: PlanTier;
  limit: number | null;
  canCreate: boolean;
}

export async function getOrgUsage(ctx: Ctx): Promise<OrgUsage> {
  const [[{ value: equipmentCount }], [sub]] = await Promise.all([
    db.select({ value: count() }).from(equipments).where(eq(equipments.orgId, ctx.orgId)),
    db
      .select({ planTier: subscriptions.planTier })
      .from(subscriptions)
      .where(eq(subscriptions.orgId, ctx.orgId))
      .limit(1),
  ]);
  const planTier = sub?.planTier ?? "free";
  return {
    equipmentCount,
    planTier,
    limit: planTier === "pro" ? null : FREE_PLAN_EQUIPMENT_LIMIT,
    canCreate: canCreateEquipment(planTier, equipmentCount),
  };
}

function toRow(input: EquipmentInput) {
  return {
    internalId: input.internalId,
    name: input.name,
    brand: input.brand,
    model: input.model,
    serialNumber: input.serialNumber,
    location: input.location,
    status: input.status,
    calibrationFrequencyMonths: input.calibrationFrequencyMonths,
    lastCalibrationDate: input.lastCalibrationDate,
    nextCalibrationDate: input.nextCalibrationDate,
  };
}

const DUPLICATE_MESSAGE = "Ce code interne est déjà utilisé dans votre organisation";

export async function createEquipment(ctx: Ctx, input: EquipmentInput): Promise<Equipment> {
  assertCan(ctx.role, "equipment:write");
  try {
    return await db.transaction(async (tx) => {
      // Verrou sur l'organisation : sérialise les créations concurrentes pour
      // que la limite du plan gratuit ne puisse pas être contournée.
      await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, ctx.orgId))
        .for("update");

      const [[{ value: current }], [sub]] = await Promise.all([
        tx.select({ value: count() }).from(equipments).where(eq(equipments.orgId, ctx.orgId)),
        tx
          .select({ planTier: subscriptions.planTier })
          .from(subscriptions)
          .where(eq(subscriptions.orgId, ctx.orgId))
          .limit(1),
      ]);
      if (!canCreateEquipment(sub?.planTier ?? "free", current)) {
        throw new PlanLimitError(
          `Le plan gratuit est limité à ${FREE_PLAN_EQUIPMENT_LIMIT} équipements. Passez au plan Pro pour continuer.`,
        );
      }

      const [row] = await tx
        .insert(equipments)
        .values({ ...toRow(input), orgId: ctx.orgId })
        .returning();
      return row;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ConflictError(DUPLICATE_MESSAGE);
    throw e;
  }
}

export async function updateEquipment(
  ctx: Ctx,
  id: string,
  input: EquipmentInput,
): Promise<Equipment> {
  assertCan(ctx.role, "equipment:write");
  if (!isUuid(id)) throw new NotFoundError();
  try {
    const [row] = await db
      .update(equipments)
      .set(toRow(input))
      .where(and(eq(equipments.id, id), eq(equipments.orgId, ctx.orgId)))
      .returning();
    if (!row) throw new NotFoundError();
    return row;
  } catch (e) {
    if (isUniqueViolation(e)) throw new ConflictError(DUPLICATE_MESSAGE);
    throw e;
  }
}

/** Supprime l'équipement (et son historique) ; renvoie les clés des certificats à purger. */
export async function deleteEquipment(ctx: Ctx, id: string): Promise<string[]> {
  assertCan(ctx.role, "equipment:delete");
  if (!isUuid(id)) throw new NotFoundError();
  return db.transaction(async (tx) => {
    const files = await tx
      .select({ key: maintenanceRecords.certificateFileUrl })
      .from(maintenanceRecords)
      .innerJoin(equipments, eq(equipments.id, maintenanceRecords.equipmentId))
      .where(and(eq(equipments.id, id), eq(equipments.orgId, ctx.orgId)));
    const deleted = await tx
      .delete(equipments)
      .where(and(eq(equipments.id, id), eq(equipments.orgId, ctx.orgId)))
      .returning({ id: equipments.id });
    if (deleted.length === 0) throw new NotFoundError();
    return files.map((f) => f.key).filter((k): k is string => !!k);
  });
}

/**
 * Suggestion du prochain code interne : EQ-{année}-{NNN}.
 */
export async function suggestInternalId(ctx: Ctx, year = new Date().getUTCFullYear()): Promise<string> {
  const prefix = `EQ-${year}-`;
  const rows = await db
    .select({ internalId: equipments.internalId })
    .from(equipments)
    .where(and(eq(equipments.orgId, ctx.orgId), ilike(equipments.internalId, `${prefix}%`)));
  const max = rows.reduce((acc, r) => {
    const n = Number.parseInt(r.internalId.slice(prefix.length), 10);
    return Number.isFinite(n) && n > acc ? n : acc;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/**
 * Données minimales pour la page /scan/{token} (§3.C). id et orgId servent
 * uniquement à la redirection d'un utilisateur connecté de la même organisation.
 */
export async function getEquipmentByQrToken(token: string) {
  if (!isUuid(token)) return null;
  const [row] = await db
    .select({
      id: equipments.id,
      orgId: equipments.orgId,
      internalId: equipments.internalId,
      nextCalibrationDate: equipments.nextCalibrationDate,
    })
    .from(equipments)
    .where(eq(equipments.qrCodeToken, token))
    .limit(1);
  return row ?? null;
}
