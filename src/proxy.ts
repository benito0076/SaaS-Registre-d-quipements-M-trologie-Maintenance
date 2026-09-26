import { NextResponse, type NextRequest } from "next/server";

/**
 * Contrôle optimiste : redirige vers /login si aucun cookie de session n'est
 * présent. La vérification réelle (signature, utilisateur, org_id) est faite
 * côté serveur dans chaque page, action et Route Handler.
 */
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((c) => request.cookies.has(c));
  if (!hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/equipments/:path*", "/labels/:path*", "/team/:path*", "/billing/:path*"],
};
