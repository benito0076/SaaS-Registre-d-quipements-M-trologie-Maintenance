import { z } from "zod";
import {
  EQUIPMENT_STATUSES,
  RECORD_RESULTS,
  RECORD_TYPES,
  USER_ROLES,
} from "@/db/enums";
import { isIsoDate } from "./dates";
import { ValidationError } from "./errors";

/*
 * Les messages d'erreur sont des clés du namespace « validation »
 * (messages/*.json), traduites à l'affichage. Les règles sans message
 * explicite sont converties d'après le code Zod (voir issueKey).
 */
const KEYS = {
  invalidDate: "invalidDate",
  invalidEmail: "invalidEmail",
  integer: "integer",
  minMonths: "minMonths",
  maxMonths: "maxMonths",
  passwordMin: "passwordMin",
  companyRequired: "companyRequired",
} as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const isoDate = z.string().trim().refine(isIsoDate, KEYS.invalidDate);

export const equipmentInputSchema = z.object({
  internalId: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(255),
  brand: optionalText(100),
  model: optionalText(100),
  serialNumber: optionalText(100),
  location: optionalText(100),
  status: z.enum(EQUIPMENT_STATUSES).default("operational"),
  calibrationFrequencyMonths: z.coerce
    .number()
    .int(KEYS.integer)
    .min(1, KEYS.minMonths)
    .max(240, KEYS.maxMonths),
  lastCalibrationDate: isoDate
    .optional()
    .nullable()
    .transform((v) => v ?? null),
  nextCalibrationDate: isoDate,
});
export type EquipmentInput = z.output<typeof equipmentInputSchema>;

export const recordInputSchema = z.object({
  type: z.enum(RECORD_TYPES),
  performedAt: isoDate,
  performedBy: z.string().trim().min(1).max(255),
  statusResult: z.enum(RECORD_RESULTS),
  comments: z
    .string()
    .trim()
    .max(5000)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
});
export type RecordInput = z.output<typeof recordInputSchema>;

export const signupSchema = z.object({
  companyName: z.string().trim().min(2, KEYS.companyRequired).max(255),
  fullName: z.string().trim().max(255).optional().transform((v) => v || null),
  email: z.string().trim().toLowerCase().pipe(z.email(KEYS.invalidEmail)),
  password: z.string().min(10, KEYS.passwordMin).max(200),
});

export const teamMemberSchema = z.object({
  fullName: z.string().trim().max(255).optional().transform((v) => v || null),
  email: z.string().trim().toLowerCase().pipe(z.email(KEYS.invalidEmail)),
  role: z.enum(USER_ROLES),
  password: z.string().min(10, KEYS.passwordMin).max(200),
});

const EXPLICIT_KEYS = new Set<string>(Object.values(KEYS));

/** Clé de traduction d'une erreur Zod (« tooLong:100 » porte son paramètre). */
function issueKey(issue: z.core.$ZodIssue): string {
  if (EXPLICIT_KEYS.has(issue.message)) return issue.message;
  switch (issue.code) {
    case "too_big":
      return issue.origin === "string" ? `tooLong:${issue.maximum}` : "invalidValue";
    case "too_small":
    case "invalid_type":
      return "required";
    default:
      return "invalidValue";
  }
}

/** Valide ou lève ValidationError (avec erreurs par champ). */
export function parseOrThrow<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const res = schema.safeParse(data);
  if (!res.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of res.error.issues) {
      const field = String(issue.path[0] ?? "_");
      const key = issueKey(issue);
      fieldErrors[field] ??= [];
      if (!fieldErrors[field].includes(key)) fieldErrors[field].push(key);
    }
    throw new ValidationError("invalidData", fieldErrors);
  }
  return res.data;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Convertit un FormData en objet simple (les champs vides deviennent undefined). */
export function formToObject(form: FormData, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const v = form.get(f);
    if (typeof v === "string" && v.trim() !== "") out[f] = v;
  }
  return out;
}

/** Premier fichier non vide d'un champ (plusieurs sélecteurs peuvent partager le nom). */
export function firstFile(form: FormData, name: string): File | null {
  for (const v of form.getAll(name)) {
    if (typeof v !== "string" && v.size > 0) return v;
  }
  return null;
}
