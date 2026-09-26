import { daysUntil, formatDateFr } from "./dates";

/**
 * Règles du moteur d'alertes (§3.D) :
 *  - J-30 : badge orange ;
 *  - J-7  : badge rouge ;
 *  - J-0  : badge rouge (échéance aujourd'hui) ;
 *  - dépassé (next_calibration_date < aujourd'hui) : badge rouge, rappel quotidien.
 */
export type AlertLevel = "j30" | "j7" | "j0" | "overdue";

/**
 * Niveau d'alerte d'un équipement pour le jour `today`.
 *
 * `since` (≤ today) permet le rattrapage : si le cron n'a pas pu s'exécuter
 * certains jours, un seuil J-30 ou J-7 franchi entre `since` et `today` est
 * quand même signalé. Par défaut `since = today` (seuils au jour exact).
 */
export function alertLevelFor(
  nextCalibrationDate: string,
  today: string,
  since: string = today,
): AlertLevel | null {
  const d = daysUntil(nextCalibrationDate, today);
  if (d < 0) return "overdue";
  if (d === 0) return "j0";
  const missedDays = Math.max(0, daysUntil(today, since)); // jours à rattraper
  if (d <= 7 && d >= 7 - missedDays) return "j7";
  if (d <= 30 && d >= 30 - missedDays) return "j30";
  return null;
}

export const ALERT_COLORS: Record<AlertLevel, { bg: string; fg: string; label: string }> = {
  j30: { bg: "#f97316", fg: "#ffffff", label: "J-30" },
  j7: { bg: "#dc2626", fg: "#ffffff", label: "J-7" },
  j0: { bg: "#dc2626", fg: "#ffffff", label: "Aujourd'hui" },
  overdue: { bg: "#dc2626", fg: "#ffffff", label: "Échu" },
};

export interface AlertItem {
  equipmentId: string;
  internalId: string;
  name: string;
  location: string | null;
  nextCalibrationDate: string;
  level: AlertLevel;
  daysLeft: number;
}

const LEVEL_ORDER: Record<AlertLevel, number> = { overdue: 0, j0: 1, j7: 2, j30: 3 };

export function sortAlerts(items: AlertItem[]): AlertItem[] {
  return [...items].sort(
    (a, b) =>
      LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level] ||
      a.nextCalibrationDate.localeCompare(b.nextCalibrationDate) ||
      a.internalId.localeCompare(b.internalId),
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function describeDelay(item: AlertItem): string {
  if (item.daysLeft < 0) {
    const n = -item.daysLeft;
    return `échu depuis ${n} jour${n > 1 ? "s" : ""}`;
  }
  if (item.daysLeft === 0) return "échéance aujourd'hui";
  return `dans ${item.daysLeft} jours`;
}

/** Gabarit e-mail récapitulatif (HTML responsive, styles en ligne) + version texte. */
export function renderAlertEmail(params: {
  orgName: string;
  appUrl: string;
  items: AlertItem[];
}): { subject: string; html: string; text: string } {
  const items = sortAlerts(params.items);
  const overdue = items.filter((i) => i.level === "overdue").length;
  const subject =
    overdue > 0
      ? `⚠️ ${overdue} équipement${overdue > 1 ? "s" : ""} échu${overdue > 1 ? "s" : ""} – ${items.length} alerte${items.length > 1 ? "s" : ""} métrologie`
      : `${items.length} échéance${items.length > 1 ? "s" : ""} d'étalonnage à venir`;

  const rows = items
    .map((i) => {
      const c = ALERT_COLORS[i.level];
      const url = `${params.appUrl}/equipments/${i.equipmentId}`;
      return `<tr>
  <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
    <span style="display:inline-block;padding:2px 8px;border-radius:9999px;background:${c.bg};color:${c.fg};font-size:12px;font-weight:600;white-space:nowrap;">${c.label}</span>
  </td>
  <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
    <a href="${escapeHtml(url)}" style="color:#111827;font-weight:600;text-decoration:none;">${escapeHtml(i.internalId)} – ${escapeHtml(i.name)}</a>
    <div style="color:#6b7280;font-size:13px;margin-top:2px;">${i.location ? `${escapeHtml(i.location)} · ` : ""}Échéance : ${formatDateFr(i.nextCalibrationDate)} (${describeDelay(i)})</div>
  </td>
  <td style="padding:12px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top;text-align:right;">
    <a href="${escapeHtml(url)}" style="color:#2563eb;font-size:13px;white-space:nowrap;">Ouvrir la fiche →</a>
  </td>
</tr>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden;">
<tr><td style="padding:24px 24px 8px;">
  <h1 style="margin:0;font-size:20px;color:#111827;">Alertes d'étalonnage et de maintenance</h1>
  <p style="margin:8px 0 0;color:#4b5563;font-size:14px;">${escapeHtml(params.orgName)} · ${items.length} équipement${items.length > 1 ? "s" : ""} concerné${items.length > 1 ? "s" : ""}</p>
</td></tr>
<tr><td style="padding:8px 16px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
${rows}
  </table>
</td></tr>
<tr><td style="padding:0 24px 24px;">
  <a href="${escapeHtml(params.appUrl)}/dashboard" style="display:inline-block;background:#111827;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;font-size:14px;">Voir l'inventaire</a>
  <p style="margin:16px 0 0;color:#9ca3af;font-size:12px;">Légende : <span style="color:#f97316;font-weight:600;">orange</span> = échéance dans 30 jours, <span style="color:#dc2626;font-weight:600;">rouge</span> = échéance dans 7 jours, aujourd'hui ou dépassée.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  const text = [
    `Alertes d'étalonnage et de maintenance – ${params.orgName}`,
    "",
    ...items.map(
      (i) =>
        `[${ALERT_COLORS[i.level].label}] ${i.internalId} – ${i.name} : ${formatDateFr(i.nextCalibrationDate)} (${describeDelay(i)})\n  ${params.appUrl}/equipments/${i.equipmentId}`,
    ),
    "",
    `Inventaire : ${params.appUrl}/dashboard`,
  ].join("\n");

  return { subject, html, text };
}
