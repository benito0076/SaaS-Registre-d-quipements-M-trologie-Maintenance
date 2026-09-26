import "server-only";
import { NextResponse } from "next/server";
import type { Locale } from "@/i18n/config";
import { translateAppError } from "@/i18n/errors";
import { localeFromRequest } from "@/i18n/request-locale";
import { translator } from "@/i18n/translator";
import { isAppError, ValidationError } from "@/lib/errors";
import { getCurrentUser, type TenantContext } from "@/lib/session";

/** Convertit une erreur en réponse JSON traduite (404 pour toute ressource hors organisation). */
export function errorResponse(e: unknown, locale: Locale): NextResponse {
  if (isAppError(e)) {
    return NextResponse.json(translateAppError(e, locale), { status: e.status });
  }
  console.error("[api] erreur inattendue", e);
  return NextResponse.json({ error: translator(locale)("errors.internal") }, { status: 500 });
}

/**
 * Enveloppe des Route Handlers authentifiés : 401 sans session valide,
 * sinon exécute le handler avec le contexte de tenant (org_id) de l'utilisateur.
 */
export function withTenant<P>(
  handler: (req: Request, ctx: TenantContext, params: P) => Promise<Response>,
) {
  return async (req: Request, route: { params: Promise<P> }): Promise<Response> => {
    const locale = localeFromRequest(req);
    try {
      const user = await getCurrentUser();
      if (!user) {
        return NextResponse.json({ error: translator(locale)("errors.unauthenticated") }, { status: 401 });
      }
      return await handler(req, user, await route.params);
    } catch (e) {
      return errorResponse(e, locale);
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ValidationError("invalidJson");
  }
}
