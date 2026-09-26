import { NextResponse } from "next/server";
import { qrSvg } from "@/lib/qr";
import { withTenant } from "@/server/api";
import { getEquipment } from "@/server/equipments";

/** Téléchargement du QR code vectoriel (SVG) d'un équipement. */
export const GET = withTenant<{ id: string }>(async (_req, ctx, { id }) => {
  const equipment = await getEquipment(ctx, id);
  const svg = await qrSvg(equipment.qrCodeToken!);
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Content-Disposition": `attachment; filename="qr-${encodeURIComponent(equipment.internalId)}.svg"`,
      "Cache-Control": "private, no-store",
    },
  });
});
