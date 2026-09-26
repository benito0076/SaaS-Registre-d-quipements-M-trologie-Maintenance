import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { isLocale, LOCALE_COOKIE, negotiateLocale, type Locale } from "./config";
import { MESSAGES } from "./messages";

/** Langue de la requête : cookie explicite, sinon Accept-Language, sinon français. */
export async function resolveRequestLocale(): Promise<Locale> {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  return negotiateLocale((await headers()).get("accept-language"));
}

export default getRequestConfig(async () => {
  const locale = await resolveRequestLocale();
  return { locale, messages: MESSAGES[locale], timeZone: "UTC" };
});
