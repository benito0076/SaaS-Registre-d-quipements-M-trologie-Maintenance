import { isAppError, PlanLimitError, ValidationError } from "@/lib/errors";

export interface ActionState {
  ok?: boolean;
  error?: string;
  code?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Valeurs saisies, renvoyées pour pré-remplir le formulaire en cas d'erreur. */
  values?: Record<string, string>;
}

export function formValues(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (typeof v === "string" && !k.startsWith("$") && k !== "password") out[k] = v;
  }
  return out;
}

/** Traduit une erreur métier en état de formulaire ; relance les erreurs inattendues. */
export function toActionState(e: unknown, form?: FormData): ActionState {
  const values = form ? formValues(form) : undefined;
  if (e instanceof ValidationError) {
    const hasFieldErrors = Object.values(e.fieldErrors).some((v) => v?.length);
    return { error: e.message, fieldErrors: hasFieldErrors ? e.fieldErrors : undefined, values };
  }
  if (e instanceof PlanLimitError) return { error: e.message, code: e.code, values };
  if (isAppError(e)) return { error: e.message, values };
  throw e;
}
