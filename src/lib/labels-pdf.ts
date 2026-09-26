import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { translator } from "@/i18n/translator";
import { formatDate } from "./dates";

/**
 * Génération PDF des étiquettes (QR code vectoriel : chaque module est un
 * rectangle, aucune image matricielle).
 *  - "single" : une étiquette 50 × 30 mm par page (imprimantes d'étiquettes) ;
 *  - "a4"     : planche A4 de 3 × 9 étiquettes 50 × 30 mm.
 */

export type LabelFormat = "single" | "a4";

export interface LabelData {
  internalId: string;
  name: string;
  nextCalibrationDate: string;
  url: string;
}

const MM = 72 / 25.4;
export const LABEL_W_MM = 50;
export const LABEL_H_MM = 30;
const A4 = { w: 210, h: 297 };
export const A4_GRID = { cols: 3, rows: 9, gapX: 5, gapY: 0 };

/** Les polices standard PDF (WinAnsi) ne couvrent pas tous les caractères Unicode. */
function winAnsiSafe(text: string, font: PDFFont): string {
  return [...text]
    .map((ch) => {
      try {
        font.encodeText(ch);
        return ch;
      } catch {
        const base = ch.normalize("NFD").replace(/\p{Diacritic}/gu, "");
        try {
          font.encodeText(base);
          return base;
        } catch {
          return "?";
        }
      }
    })
    .join("");
}

function fitText(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Découpe en 2 lignes max. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number, maxLines = 2): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (let i = 0; i < words.length; i++) {
    const candidate = current ? `${current} ${words[i]}` : words[i];
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = words[i];
    if (lines.length === maxLines - 1) {
      current = [current, ...words.slice(i + 1)].join(" ");
      break;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines).map((l) => fitText(l, font, size, maxWidth));
}

function drawQr(page: PDFPage, url: string, x: number, y: number, size: number) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = size / n;
  for (let r = 0; r < n; r++) {
    // Regroupe les modules noirs contigus d'une ligne en un seul rectangle.
    let c = 0;
    while (c < n) {
      if (!qr.modules.get(r, c)) {
        c++;
        continue;
      }
      const start = c;
      while (c < n && qr.modules.get(r, c)) c++;
      page.drawRectangle({
        x: x + start * cell,
        y: y + size - (r + 1) * cell,
        width: (c - start) * cell,
        height: cell,
        color: rgb(0, 0, 0),
      });
    }
  }
}

function drawLabel(
  page: PDFPage,
  label: LabelData,
  originX: number,
  originY: number,
  fonts: { regular: PDFFont; bold: PDFFont },
  text: { nextDue: string; date: (iso: string) => string },
) {
  const pad = 2 * MM;
  const h = LABEL_H_MM * MM;
  const w = LABEL_W_MM * MM;
  const qrSize = h - 2 * pad;
  drawQr(page, label.url, originX + pad, originY + pad, qrSize);

  const textX = originX + pad + qrSize + 2 * MM;
  const textW = w - (textX - originX) - pad;
  let y = originY + h - pad - 7;

  const id = winAnsiSafe(label.internalId, fonts.bold);
  page.drawText(fitText(id, fonts.bold, 8, textW), { x: textX, y, size: 8, font: fonts.bold });
  y -= 9;
  for (const line of wrap(winAnsiSafe(label.name, fonts.regular), fonts.regular, 6.5, textW)) {
    page.drawText(line, { x: textX, y, size: 6.5, font: fonts.regular });
    y -= 7.5;
  }
  page.drawText(fitText(winAnsiSafe(text.nextDue, fonts.regular), fonts.regular, 5.5, textW), {
    x: textX,
    y: originY + pad + 9,
    size: 5.5,
    font: fonts.regular,
    color: rgb(0.35, 0.35, 0.35),
  });
  page.drawText(text.date(label.nextCalibrationDate), {
    x: textX,
    y: originY + pad,
    size: 9,
    font: fonts.bold,
  });
}

export async function renderLabelsPdf(
  labels: LabelData[],
  format: LabelFormat,
  locale: Locale = DEFAULT_LOCALE,
): Promise<Uint8Array> {
  const t = translator(locale);
  const text = { nextDue: t("labels.nextDue"), date: (iso: string) => formatDate(iso, locale) };
  const doc = await PDFDocument.create();
  doc.setTitle(t("labels.pdfTitle"));
  doc.setLanguage(locale);
  doc.setCreator("Registre Métrologie");
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  if (format === "single") {
    for (const label of labels) {
      const page = doc.addPage([LABEL_W_MM * MM, LABEL_H_MM * MM]);
      drawLabel(page, label, 0, 0, fonts, text);
    }
  } else {
    const { cols, rows, gapX, gapY } = A4_GRID;
    const gridW = cols * LABEL_W_MM + (cols - 1) * gapX;
    const gridH = rows * LABEL_H_MM + (rows - 1) * gapY;
    const marginX = (A4.w - gridW) / 2;
    const marginY = (A4.h - gridH) / 2;
    const perPage = cols * rows;
    for (let i = 0; i < labels.length; i += perPage) {
      const page = doc.addPage([A4.w * MM, A4.h * MM]);
      labels.slice(i, i + perPage).forEach((label, j) => {
        const col = j % cols;
        const row = Math.floor(j / cols);
        const x = (marginX + col * (LABEL_W_MM + gapX)) * MM;
        const yTop = A4.h - marginY - row * (LABEL_H_MM + gapY);
        const y = (yTop - LABEL_H_MM) * MM;
        // Repère de découpe léger
        page.drawRectangle({
          x,
          y,
          width: LABEL_W_MM * MM,
          height: LABEL_H_MM * MM,
          borderColor: rgb(0.85, 0.85, 0.85),
          borderWidth: 0.3,
        });
        drawLabel(page, label, x, y, fonts, text);
      });
    }
  }
  return doc.save();
}
