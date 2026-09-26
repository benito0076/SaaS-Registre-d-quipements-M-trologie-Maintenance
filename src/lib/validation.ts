import { z } from "zod";
import {
  EQUIPMENT_STATUSES,
  RECORD_RESULTS,
  RECORD_TYPES,
  USER_ROLES,
} from "@/db/enums";
import { isIsoDate } from "./dates";
import { ValidationError } from "./errors";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const isoDate = z
  .string()
  .trim()
  .refine(isIsoDate, "Date invalide (format AAAA-MM-JJ)");

export const equipmentInputSchema = z.object({
  internalId: z.string().trim().min(1, "Le code interne est obligatoire").max(100),
  name: z.string().trim().min(1, "Le nom est obligatoire").max(255),
  brand: optionalText(100),
  model: optionalText(100),
  serialNumber: optionalText(100),
  location: optionalText(100),
  status: z.enum(EQUIPMENT_STATUSES).default("operational"),
  calibrationFrequencyMonths: z.coerce
    .number({ error: "La fréquence est obligatoire" })
    .int("Nombre entier de mois")
    .min(1, "Au moins 1 mois")
    .max(240, "240 mois maximum"),
  lastCalibrationDate: isoDate
    .optional()
    .nullable()
    .transform((v) => v ?? null),
  nextCalibrationDate: isoDate,
});
export type EquipmentInput = z.output<typeof equipmentInputSchema>;

export const recordInputSchema = z.object({
  type: z.enum(RECORD_TYPES, { error: "Type d'intervention invalide" }),
  performedAt: isoDate,
  performedBy: z.string().trim().min(1, "Champ obligatoire").max(255),
  statusResult: z.enum(RECORD_RESULTS, { error: "Résultat invalide" }),
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
  companyName: z.string().trim().min(2, "Nom de l'entreprise requis").max(255),
  fullName: z.string().trim().max(255).optional().transform((v) => v || null),
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail invalide")),
  password: z.string().min(10, "10 caractères minimum").max(200),
});

export const teamMemberSchema = z.object({
  fullName: z.string().trim().max(255).optional().transform((v) => v || null),
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail invalide")),
  role: z.enum(USER_ROLES),
  password: z.string().min(10, "10 caractères minimum").max(200),
});

/** Valide ou lève ValidationError (avec erreurs par champ). */
export function parseOrThrow<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const res = schema.safeParse(data);
  if (!res.success) {
    const { fieldErrors } = z.flattenError(res.error);
    throw new ValidationError(
      "Données invalides",
      fieldErrors as Record<string, string[] | undefined>,
    );
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
