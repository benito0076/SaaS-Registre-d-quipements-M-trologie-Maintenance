import { createTranslator } from "next-intl";
import type { Locale } from "./config";
import { MESSAGES } from "./messages";

/**
 * Traducteur hors composants React (e-mails, PDF, erreurs d'API) :
 * la langue est passée explicitement.
 */
export function translator(locale: Locale) {
  return createTranslator({ locale, messages: MESSAGES[locale] });
}
export type Translator = ReturnType<typeof translator>;
