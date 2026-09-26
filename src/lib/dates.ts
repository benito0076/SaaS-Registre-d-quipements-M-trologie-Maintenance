/**
 * Utilitaires de dates « calendaires » (sans heure) au format ISO YYYY-MM-DD,
 * tel que stocké dans les colonnes PostgreSQL de type DATE. Tous les calculs
 * sont faits en UTC pour être indépendants du fuseau du serveur.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function parse(iso: string): Date {
  if (!isIsoDate(iso)) throw new Error(`Date invalide : ${iso}`);
  return new Date(`${iso}T00:00:00Z`);
}

/**
 * Ajoute des mois à une date. Si le jour n'existe pas dans le mois cible,
 * on retient le dernier jour du mois (31/01 + 1 mois = 28/02 ou 29/02).
 */
export function addMonths(iso: string, months: number): string {
  const d = parse(iso);
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return new Date(parse(iso).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/** Nombre de jours entre `today` et `iso` (négatif si `iso` est passé). */
export function daysUntil(iso: string, today: string = todayIso()): number {
  return Math.round((parse(iso).getTime() - parse(today).getTime()) / DAY_MS);
}

export function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Échéance de conformité affichée dans l'inventaire et sur la page de scan. */
export type DueState = "overdue" | "due_soon" | "ok";

/** « Échu » = date d'échéance strictement passée ; « bientôt » = ≤ 30 jours. */
export function dueState(nextCalibrationDate: string, today: string = todayIso()): DueState {
  const days = daysUntil(nextCalibrationDate, today);
  if (days < 0) return "overdue";
  if (days <= 30) return "due_soon";
  return "ok";
}
