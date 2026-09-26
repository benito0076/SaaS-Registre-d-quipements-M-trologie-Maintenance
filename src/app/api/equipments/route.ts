import { NextResponse } from "next/server";
import { equipmentInputSchema, parseOrThrow } from "@/lib/validation";
import { readJson, withTenant } from "@/server/api";
import {
  createEquipment,
  listEquipments,
  type EquipmentFilter,
  type EquipmentSort,
} from "@/server/equipments";

export const GET = withTenant(async (req, ctx) => {
  const url = new URL(req.url);
  const items = await listEquipments(ctx, {
    q: url.searchParams.get("q") ?? undefined,
    filter: (url.searchParams.get("filter") as EquipmentFilter) ?? undefined,
    sort: (url.searchParams.get("sort") as EquipmentSort) ?? undefined,
    dir: url.searchParams.get("dir") === "desc" ? "desc" : "asc",
  });
  return NextResponse.json({ data: items });
});

export const POST = withTenant(async (req, ctx) => {
  const input = parseOrThrow(equipmentInputSchema, await readJson(req));
  const equipment = await createEquipment(ctx, input);
  return NextResponse.json({ data: equipment }, { status: 201 });
});
