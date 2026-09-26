import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { equipments } from "@/db/schema";
import { isUuid } from "@/lib/validation";
import type { Ctx } from "./context";

/** Équipements à étiqueter (tous ceux de l'organisation si `ids` est vide). */
export async function getLabelEquipments(ctx: Ctx, ids: string[]) {
  const validIds = ids.filter(isUuid);
  if (ids.length > 0 && validIds.length === 0) return [];
  const conditions = [eq(equipments.orgId, ctx.orgId)];
  if (validIds.length > 0) conditions.push(inArray(equipments.id, validIds));
  return db
    .select({
      id: equipments.id,
      internalId: equipments.internalId,
      name: equipments.name,
      nextCalibrationDate: equipments.nextCalibrationDate,
      qrCodeToken: equipments.qrCodeToken,
    })
    .from(equipments)
    .where(and(...conditions))
    .orderBy(asc(equipments.internalId));
}

export function parseIds(value: string | string[] | undefined | null): string[] {
  const raw = Array.isArray(value) ? value.join(",") : (value ?? "");
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 1000);
}
