import { NextResponse } from "next/server";
import {
  contentTypeForKey,
  isLocalStorage,
  readLocalCertificate,
  signedCertificateUrl,
} from "@/lib/storage";
import { withTenant } from "@/server/api";
import { getCertificateForRecord } from "@/server/records";

export const dynamic = "force-dynamic";

/**
 * Accès sécurisé à un certificat : l'appartenance de l'intervention à
 * l'organisation est vérifiée (404 sinon), puis redirection vers une URL
 * signée S3/R2 valable 5 minutes (ou service direct en stockage local).
 */
export const GET = withTenant<{ recordId: string }>(async (_req, ctx, { recordId }) => {
  const { key, fileName } = await getCertificateForRecord(ctx, recordId);
  const headers = { "Cache-Control": "private, no-store" };
  if (isLocalStorage()) {
    const bytes = await readLocalCertificate(key);
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        ...headers,
        "Content-Type": contentTypeForKey(key),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
  const url = await signedCertificateUrl(key, fileName);
  return NextResponse.redirect(url, { status: 302, headers });
});
