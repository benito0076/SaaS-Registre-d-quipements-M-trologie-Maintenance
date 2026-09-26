import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, LogIn, XCircle } from "lucide-react";
import { daysUntil, formatDateFr, todayIso } from "@/lib/dates";
import { getCurrentUser } from "@/lib/session";
import { getEquipmentByQrToken } from "@/server/equipments";

export const metadata: Metadata = {
  title: "Équipement",
  robots: { index: false, follow: false },
};

/**
 * Page d'atterrissage du QR code (§3.C), optimisée mobile :
 * rendu serveur, une requête indexée (qr_code_token UNIQUE), aucun JS client,
 * aucune police ni image externe.
 *  - utilisateur connecté de la même organisation → fiche de l'équipement ;
 *  - sinon → vue publique en lecture seule limitée au statut (vert : conforme,
 *    rouge : échu), au code interne, à la prochaine échéance et au lien de connexion.
 */
export default async function ScanPage({ params }: PageProps<"/scan/[token]">) {
  const { token } = await params;
  const [equipment, user] = await Promise.all([getEquipmentByQrToken(token), getCurrentUser()]);
  if (!equipment) notFound();

  if (user && user.orgId === equipment.orgId) {
    redirect(`/equipments/${equipment.id}`);
  }

  const today = todayIso();
  const ok = daysUntil(equipment.nextCalibrationDate, today) >= 0;

  return (
    <main className="flex flex-1 flex-col items-center bg-muted/40 px-4 py-8">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-background shadow-sm ring-1 ring-foreground/10">
        <div className={`flex flex-col items-center gap-2 px-6 py-8 text-white ${ok ? "bg-green-600" : "bg-red-600"}`}>
          {ok ? <CheckCircle2 className="size-14" aria-hidden /> : <XCircle className="size-14" aria-hidden />}
          <div className="text-2xl font-bold">{ok ? "Conforme" : "Échu"}</div>
          <div className="text-sm opacity-90">
            {ok ? "Étalonnage / contrôle à jour" : "Échéance d'étalonnage dépassée"}
          </div>
        </div>
        <dl className="grid gap-4 px-6 py-6">
          <div>
            <dt className="text-xs text-muted-foreground">Code interne</dt>
            <dd className="font-mono text-lg font-semibold">{equipment.internalId}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Prochaine échéance</dt>
            <dd className={`text-lg font-semibold tabular-nums ${ok ? "" : "text-red-600"}`}>
              {formatDateFr(equipment.nextCalibrationDate)}
            </dd>
          </div>
        </dl>
        {!user && (
          <div className="border-t px-6 py-4">
            <a
              href={`/login?callbackUrl=${encodeURIComponent(`/scan/${token}`)}`}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-foreground text-base font-medium text-background"
            >
              <LogIn className="size-5" aria-hidden /> Se connecter pour intervenir
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
