import { ValidationError, type AppError } from "@/lib/errors";
import type { Locale } from "./config";
import { translator } from "./translator";

export interface TranslatedError {
  error: string;
  code?: string;
  fieldErrors?: Record<string, string[]>;
}

/** Traduit une erreur métier (clé + paramètres) et ses erreurs de champ. */
export function translateAppError(e: AppError, locale: Locale): TranslatedError {
  const t = translator(locale);
  const out: TranslatedError = {
    error: t(`errors.${e.key}`, e.params as never),
  };
  if ("code" in e) out.code = e.code;
  if (e instanceof ValidationError) {
    const entries = Object.entries(e.fieldErrors).filter(([, v]) => v?.length);
    if (entries.length > 0) {
      out.fieldErrors = Object.fromEntries(
        entries.map(([field, keys]) => [
          field,
          keys!.map((raw) => {
            const [key, n] = raw.split(":");
            return t(`validation.${key}` as never, { n: Number(n) } as never);
          }),
        ]),
      );
    }
  }
  return out;
}
