import { isLocale, LOCALE_COOKIE, negotiateLocale, type Locale } from "./config";

export function localeFromRequest(req: Request): Locale {
  const cookie = req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim().split("="))
    .find(([name]) => name === LOCALE_COOKIE)?.[1];
  if (isLocale(cookie)) return cookie;
  return negotiateLocale(req.headers.get("accept-language"));
}
