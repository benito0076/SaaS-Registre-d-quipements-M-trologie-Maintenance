import { getLocale } from "next-intl/server";
import { isLocale, DEFAULT_LOCALE } from "@/i18n/config";
import { translateAppError } from "@/i18n/errors";
import { isAppError } from "@/lib/errors";

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

export async function currentLocale() {
  const locale = await getLocale();
  return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

/** Traduit une erreur métier en état de formulaire ; relance les erreurs inattendues. */
export async function toActionState(e: unknown, form?: FormData): Promise<ActionState> {
  if (!isAppError(e)) throw e;
  const values = form ? formValues(form) : undefined;
  return { ...translateAppError(e, await currentLocale()), values };
}
