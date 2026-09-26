import { NextResponse } from "next/server";
import { localeFromRequest } from "@/i18n/request-locale";
import { renderLabelsPdf, type LabelFormat } from "@/lib/labels-pdf";
import { NotFoundError } from "@/lib/errors";
import { scanUrl } from "@/lib/qr";
import { withTenant } from "@/server/api";
import { getLabelEquipments, parseIds } from "@/server/labels";

/** GET /api/labels?ids=a,b&format=single|a4 → PDF d'étiquettes (QR vectoriel). */
export const GET = withTenant(async (req, ctx) => {
  const url = new URL(req.url);
  const format: LabelFormat = url.searchParams.get("format") === "single" ? "single" : "a4";
  const rows = await getLabelEquipments(ctx, parseIds(url.searchParams.get("ids")));
  if (rows.length === 0) throw new NotFoundError();
  const pdf = await renderLabelsPdf(
    rows.map((r) => ({
      internalId: r.internalId,
      name: r.name,
      nextCalibrationDate: r.nextCalibrationDate,
      url: scanUrl(r.qrCodeToken!),
    })),
    format,
    localeFromRequest(req),
  );
  const name = rows.length === 1 ? `etiquette-${rows[0].internalId}` : "etiquettes";
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${encodeURIComponent(name)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
});
