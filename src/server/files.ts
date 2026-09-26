import "server-only";
import { can } from "@/lib/permissions";
import { ForbiddenError } from "@/lib/errors";
import { deleteCertificate, storeCertificate, type StoredFile } from "@/lib/storage";
import type { RecordInput } from "@/lib/validation";
import type { Ctx } from "./context";
import { getEquipment } from "./equipments";
import { createRecord } from "./records";

/** Suppression « au mieux » des fichiers : une erreur n'interrompt pas l'opération. */
export async function purgeCertificates(keys: string[]): Promise<void> {
  await Promise.all(
    keys.map((k) =>
      deleteCertificate(k).catch((e) => console.error(`[storage] suppression impossible : ${k}`, e)),
    ),
  );
}

/**
 * Enregistre une intervention avec son certificat éventuel. Le fichier est
 * téléversé d'abord ; si l'écriture en base échoue, il est supprimé.
 */
export async function createRecordWithCertificate(
  ctx: Ctx,
  equipmentId: string,
  input: RecordInput,
  file: File | null,
) {
  // Contrôle du rôle avant tout téléversement.
  if (!can(ctx.role, "record:write")) throw new ForbiddenError();
  // …et de l'appartenance de l'équipement (404 sinon).
  await getEquipment(ctx, equipmentId);
  let stored: StoredFile | null = null;
  if (file && file.size > 0) stored = await storeCertificate(ctx.orgId, file);
  try {
    return await createRecord(ctx, equipmentId, input, stored);
  } catch (e) {
    if (stored) await purgeCertificates([stored.key]);
    throw e;
  }
}
