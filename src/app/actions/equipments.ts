"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import {
  equipmentInputSchema,
  firstFile,
  formToObject,
  parseOrThrow,
  recordInputSchema,
} from "@/lib/validation";
import { createEquipment, deleteEquipment, updateEquipment } from "@/server/equipments";
import { createRecordWithCertificate, purgeCertificates } from "@/server/files";
import { toActionState, type ActionState } from "./state";

const EQUIPMENT_FIELDS = [
  "internalId",
  "name",
  "brand",
  "model",
  "serialNumber",
  "location",
  "status",
  "calibrationFrequencyMonths",
  "lastCalibrationDate",
  "nextCalibrationDate",
] as const;

const RECORD_FIELDS = ["type", "performedAt", "performedBy", "statusResult", "comments"] as const;

export async function createEquipmentAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ctx = await requireUser();
  let id: string;
  try {
    const input = parseOrThrow(equipmentInputSchema, formToObject(form, EQUIPMENT_FIELDS));
    id = (await createEquipment(ctx, input)).id;
  } catch (e) {
    return await toActionState(e, form);
  }
  revalidatePath("/dashboard");
  redirect(`/equipments/${id}`);
}

export async function updateEquipmentAction(
  id: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ctx = await requireUser();
  try {
    const input = parseOrThrow(equipmentInputSchema, formToObject(form, EQUIPMENT_FIELDS));
    await updateEquipment(ctx, id, input);
  } catch (e) {
    return await toActionState(e, form);
  }
  revalidatePath("/dashboard");
  revalidatePath(`/equipments/${id}`);
  redirect(`/equipments/${id}`);
}

export async function deleteEquipmentAction(id: string): Promise<ActionState> {
  const ctx = await requireUser();
  try {
    const keys = await deleteEquipment(ctx, id);
    await purgeCertificates(keys);
  } catch (e) {
    return await toActionState(e);
  }
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function createRecordAction(
  equipmentId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const ctx = await requireUser();
  try {
    const input = parseOrThrow(recordInputSchema, formToObject(form, RECORD_FIELDS));
    await createRecordWithCertificate(ctx, equipmentId, input, firstFile(form, "certificate"));
  } catch (e) {
    return await toActionState(e, form);
  }
  revalidatePath("/dashboard");
  revalidatePath(`/equipments/${equipmentId}`);
  redirect(`/equipments/${equipmentId}?saved=1`);
}
