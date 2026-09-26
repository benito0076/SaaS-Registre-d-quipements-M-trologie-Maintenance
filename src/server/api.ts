import "server-only";
import { NextResponse } from "next/server";
import { isAppError, ValidationError } from "@/lib/errors";
import { getCurrentUser, type TenantContext } from "@/lib/session";

/** Convertit une erreur en réponse JSON (404 pour toute ressource hors organisation). */
export function errorResponse(e: unknown): NextResponse {
  if (isAppError(e)) {
    const body: Record<string, unknown> = { error: e.message };
    if (e instanceof ValidationError) body.fieldErrors = e.fieldErrors;
    if ("code" in e) body.code = e.code;
    return NextResponse.json(body, { status: e.status });
  }
  console.error("[api] erreur inattendue", e);
  return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
}

/**
 * Enveloppe des Route Handlers authentifiés : 401 sans session valide,
 * sinon exécute le handler avec le contexte de tenant (org_id) de l'utilisateur.
 */
export function withTenant<P>(
  handler: (req: Request, ctx: TenantContext, params: P) => Promise<Response>,
) {
  return async (req: Request, route: { params: Promise<P> }): Promise<Response> => {
    try {
      const user = await getCurrentUser();
      if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
      return await handler(req, user, await route.params);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ValidationError("Corps JSON invalide");
  }
}
