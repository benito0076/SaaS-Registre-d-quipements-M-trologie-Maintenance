import { NextResponse } from "next/server";
import { ValidationError } from "@/lib/errors";
import { equipmentInputSchema, parseOrThrow } from "@/lib/validation";
import { readJson, withTenant } from "@/server/api";
import { deleteEquipment, getEquipment, updateEquipment } from "@/server/equipments";
import { purgeCertificates } from "@/server/files";

type Params = { id: string };

export const GET = withTenant<Params>(async (_req, ctx, { id }) => {
  return NextResponse.json({ data: await getEquipment(ctx, id) });
});

/** Mise à jour partielle : les champs absents conservent leur valeur. */
export const PATCH = withTenant<Params>(async (req, ctx, { id }) => {
  const body = await readJson(req);
  if (!body || typeof body !== "object") throw new ValidationError("invalidJson");
  const current = await getEquipment(ctx, id);
  const merged = {
    internalId: current.internalId,
    name: current.name,
    brand: current.brand,
    model: current.model,
    serialNumber: current.serialNumber,
    location: current.location,
    status: current.status,
    calibrationFrequencyMonths: current.calibrationFrequencyMonths,
    lastCalibrationDate: current.lastCalibrationDate,
    nextCalibrationDate: current.nextCalibrationDate,
    ...body,
  };
  const input = parseOrThrow(equipmentInputSchema, merged);
  return NextResponse.json({ data: await updateEquipment(ctx, id, input) });
});

export const DELETE = withTenant<Params>(async (_req, ctx, { id }) => {
  const keys = await deleteEquipment(ctx, id);
  await purgeCertificates(keys);
  return new NextResponse(null, { status: 204 });
});
