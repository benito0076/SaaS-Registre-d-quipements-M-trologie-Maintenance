import "server-only";
import { getLocale } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";

/** Langue courante typée (composants serveur). */
export async function getAppLocale(): Promise<Locale> {
  const l = await getLocale();
  return isLocale(l) ? l : DEFAULT_LOCALE;
}
