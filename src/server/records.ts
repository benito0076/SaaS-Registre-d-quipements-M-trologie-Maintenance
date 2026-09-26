import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { equipments, maintenanceRecords, users, type MaintenanceRecord } from "@/db/schema";
import { computeCalibrationUpdate } from "@/lib/calibration";
import { NotFoundError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions";
import { isUuid, type RecordInput } from "@/lib/validation";
import type { Ctx } from "./context";

/**
 * Interventions. L'appartenance à l'organisation est vérifiée par jointure
 * sur equipments.org_id (maintenance_records ne porte pas d'org_id).
 */

export type RecordWithAuthor = MaintenanceRecord & { authorName: string | null };

export async function listRecords(ctx: Ctx, equipmentId: string): Promise<RecordWithAuthor[]> {
  if (!isUuid(equipmentId)) throw new NotFoundError();
  // Vérifie l'existence de l'équipement dans l'organisation (404 sinon).
  const [eqRow] = await db
    .select({ id: equipments.id })
    .from(equipments)
    .where(and(eq(equipments.id, equipmentId), eq(equipments.orgId, ctx.orgId)))
    .limit(1);
  if (!eqRow) throw new NotFoundError();

  const rows = await db
    .select({ record: maintenanceRecords, authorName: users.fullName, authorEmail: users.email })
    .from(maintenanceRecords)
    .innerJoin(equipments, eq(equipments.id, maintenanceRecords.equipmentId))
    .leftJoin(users, eq(users.id, maintenanceRecords.userId))
    .where(and(eq(maintenanceRecords.equipmentId, equipmentId), eq(equipments.orgId, ctx.orgId)))
    .orderBy(desc(maintenanceRecords.performedAt), desc(maintenanceRecords.createdAt));
  return rows.map((r) => ({ ...r.record, authorName: r.authorName ?? r.authorEmail }));
}

export interface CertificateRef {
  key: string;
  fileName: string;
}

/**
 * Crée une intervention et, si elle est conforme, recalcule la prochaine
 * échéance de l'équipement (§3.B). Opération atomique : la ligne équipement
 * est verrouillée pendant la transaction.
 */
export async function createRecord(
  ctx: Ctx,
  equipmentId: string,
  input: RecordInput,
  certificate?: CertificateRef | null,
): Promise<MaintenanceRecord> {
  assertCan(ctx.role, "record:write");
  if (!isUuid(equipmentId)) throw new NotFoundError();

  return db.transaction(async (tx) => {
    const [equipment] = await tx
      .select()
      .from(equipments)
      .where(and(eq(equipments.id, equipmentId), eq(equipments.orgId, ctx.orgId)))
      .limit(1)
      .for("update");
    if (!equipment) throw new NotFoundError();

    const [record] = await tx
      .insert(maintenanceRecords)
      .values({
        equipmentId: equipment.id,
        userId: ctx.userId,
        type: input.type,
        performedAt: input.performedAt,
        performedBy: input.performedBy,
        statusResult: input.statusResult,
        comments: input.comments,
        certificateFileUrl: certificate?.key ?? null,
        certificateFileName: certificate?.fileName ?? null,
      })
      .returning();

    const update = computeCalibrationUpdate(equipment, input);
    if (update) {
      await tx
        .update(equipments)
        .set(update)
        .where(and(eq(equipments.id, equipment.id), eq(equipments.orgId, ctx.orgId)));
    }
    return record;
  });
}

/** Renvoie la référence du certificat si l'intervention appartient à l'organisation. */
export async function getCertificateForRecord(
  ctx: Ctx,
  recordId: string,
): Promise<CertificateRef> {
  if (!isUuid(recordId)) throw new NotFoundError();
  const [row] = await db
    .select({
      key: maintenanceRecords.certificateFileUrl,
      fileName: maintenanceRecords.certificateFileName,
    })
    .from(maintenanceRecords)
    .innerJoin(equipments, eq(equipments.id, maintenanceRecords.equipmentId))
    .where(and(eq(maintenanceRecords.id, recordId), eq(equipments.orgId, ctx.orgId)))
    .limit(1);
  if (!row?.key) throw new NotFoundError();
  return { key: row.key, fileName: row.fileName ?? "certificat" };
}
