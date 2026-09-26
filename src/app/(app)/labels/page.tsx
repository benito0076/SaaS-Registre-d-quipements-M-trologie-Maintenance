import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { FileDown } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { pageTitle } from "@/i18n/metadata";
import { getAppLocale } from "@/i18n/server";
import { formatDate } from "@/lib/dates";
import { A4_GRID, LABEL_H_MM, LABEL_W_MM } from "@/lib/labels-pdf";
import { qrSvg } from "@/lib/qr";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { getLabelEquipments, parseIds } from "@/server/labels";
import { PrintButton } from "./print-button";

export const generateMetadata = pageTitle("labels");

/**
 * Aperçu et impression des étiquettes 50 × 30 mm (QR code vectoriel SVG).
 * L'impression navigateur utilise @page ; le bouton PDF produit un fichier
 * prêt pour une imprimante d'étiquettes ou une planche A4.
 */
export default async function LabelsPage({ searchParams }: PageProps<"/labels">) {
  const user = await requireUser("/labels");
  const sp = await searchParams;
  const ids = parseIds(sp.ids);
  const format = sp.format === "single" ? "single" : "a4";
  const [rows, t, tc, locale] = await Promise.all([
    getLabelEquipments(user, ids),
    getTranslations("labels"),
    getTranslations("common"),
    getAppLocale(),
  ]);
  const labels = await Promise.all(rows.map(async (r) => ({ ...r, svg: await qrSvg(r.qrCodeToken!) })));

  const query = (f: string) => `?${new URLSearchParams({ ...(ids.length ? { ids: ids.join(",") } : {}), format: f })}`;
  const pageCss =
    format === "single"
      ? `@page { size: ${LABEL_W_MM}mm ${LABEL_H_MM}mm; margin: 0; }`
      : `@page { size: A4; margin: 10mm 0; }`;

  return (
    <div className="grid gap-4">
      <style>{`@media print { ${pageCss} header, .no-print { display: none !important; } main { padding: 0 !important; max-width: none !important; } }`}</style>

      <div className="no-print flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t("title", { count: labels.length })}</h1>
          <p className="text-sm text-muted-foreground">
            {ids.length ? t("selected") : t("all")} · {t("format", { w: LABEL_W_MM, h: LABEL_H_MM })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="inline-flex rounded-lg border p-0.5">
            {[
              { f: "single", label: t("single") },
              { f: "a4", label: t("a4", { count: A4_GRID.cols * A4_GRID.rows }) },
            ].map(({ f, label }) => (
              <Link
                key={f}
                href={`/labels${query(f)}`}
                className={cn("rounded-md px-3 py-1 text-sm", format === f ? "bg-foreground text-background" : "hover:bg-muted")}
              >
                {label}
              </Link>
            ))}
          </div>
          <a href={`/api/labels${query(format)}`} target="_blank" rel="noopener" className={buttonVariants({ variant: "outline" })}>
            <FileDown /> {tc("pdf")}
          </a>
          <PrintButton label={tc("print")} />
        </div>
      </div>

      {labels.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div
          className={cn(
            format === "single" ? "flex flex-wrap gap-4 print:block" : "grid justify-center gap-x-[5mm] print:gap-y-0",
          )}
          style={format === "a4" ? { gridTemplateColumns: `repeat(${A4_GRID.cols}, ${LABEL_W_MM}mm)` } : undefined}
        >
          {labels.map((l) => (
            <div
              key={l.id}
              className={cn(
                "flex overflow-hidden bg-white text-black ring-1 ring-black/15 print:ring-black/10",
                format === "single" && "print:break-after-page print:ring-0",
              )}
              style={{ width: `${LABEL_W_MM}mm`, height: `${LABEL_H_MM}mm`, padding: "2mm", gap: "2mm", breakInside: "avoid" }}
            >
              <div
                className="shrink-0 [&_svg]:h-full [&_svg]:w-full"
                style={{ width: `${LABEL_H_MM - 4}mm`, height: `${LABEL_H_MM - 4}mm` }}
                dangerouslySetInnerHTML={{ __html: l.svg }}
              />
              <div className="flex min-w-0 flex-1 flex-col justify-between leading-tight">
                <div className="min-w-0">
                  <div className="truncate font-mono font-bold" style={{ fontSize: "8pt" }}>
                    {l.internalId}
                  </div>
                  <div className="line-clamp-2" style={{ fontSize: "6.5pt" }}>
                    {l.name}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "5.5pt", color: "#555" }}>{t("nextDue")}</div>
                  <div className="font-bold tabular-nums" style={{ fontSize: "9pt" }}>
                    {formatDate(l.nextCalibrationDate, locale)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
