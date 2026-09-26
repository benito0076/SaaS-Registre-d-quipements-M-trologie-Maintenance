import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Download, FileText, Pencil, Plus, Printer } from "lucide-react";
import { DueBadge, ResultBadge, StatusBadge } from "@/components/badges";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateFr, todayIso } from "@/lib/dates";
import { RECORD_TYPE_LABELS } from "@/lib/labels";
import { orNotFound } from "@/lib/not-found";
import { can } from "@/lib/permissions";
import { qrSvg, scanUrl } from "@/lib/qr";
import { requireUser } from "@/lib/session";
import { getEquipment } from "@/server/equipments";
import { listRecords } from "@/server/records";
import { DeleteEquipmentButton } from "./delete-button";

export const metadata: Metadata = { title: "Fiche équipement" };

export default async function EquipmentPage({ params, searchParams }: PageProps<"/equipments/[id]">) {
  const { id } = await params;
  const { saved } = await searchParams;
  const user = await requireUser(`/equipments/${id}`);
  const equipment = await orNotFound(getEquipment(user, id));
  const [records, svg] = await Promise.all([listRecords(user, id), qrSvg(equipment.qrCodeToken!)]);
  const today = todayIso();

  const details: [string, React.ReactNode][] = [
    ["Marque", equipment.brand ?? "—"],
    ["Modèle", equipment.model ?? "—"],
    ["N° de série", equipment.serialNumber ?? "—"],
    ["Emplacement", equipment.location ?? "—"],
    ["Fréquence", `${equipment.calibrationFrequencyMonths ?? 12} mois`],
    ["Dernier étalonnage", formatDateFr(equipment.lastCalibrationDate)],
  ];

  return (
    <div className="grid gap-6">
      {saved === "1" && (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <CheckCircle2 className="size-4" /> Intervention enregistrée.
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="grid gap-1">
          <div className="font-mono text-sm text-muted-foreground">{equipment.internalId}</div>
          <h1 className="text-2xl font-semibold">{equipment.name}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={equipment.status} />
            <span className="text-muted-foreground">Prochaine échéance :</span>
            <span className="font-medium tabular-nums">{formatDateFr(equipment.nextCalibrationDate)}</span>
            <DueBadge date={equipment.nextCalibrationDate} today={today} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(user.role, "record:write") && (
            <Link href={`/equipments/${equipment.id}/records/new`} className={buttonVariants({ size: "lg" })}>
              <Plus /> Ajouter une intervention
            </Link>
          )}
          {can(user.role, "equipment:write") && (
            <Link href={`/equipments/${equipment.id}/edit`} className={buttonVariants({ variant: "outline", size: "lg" })}>
              <Pencil /> Modifier
            </Link>
          )}
          {can(user.role, "equipment:delete") && <DeleteEquipmentButton id={equipment.id} internalId={equipment.internalId} />}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Caractéristiques</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {details.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>QR code</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div
              className="mx-auto w-40 [&_svg]:h-auto [&_svg]:w-full"
              aria-label={`QR code de ${equipment.internalId}`}
              role="img"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <p className="truncate text-center text-xs text-muted-foreground" title={scanUrl(equipment.qrCodeToken!)}>
              {scanUrl(equipment.qrCodeToken!)}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Link href={`/labels?ids=${equipment.id}&format=single`} className={buttonVariants({ variant: "outline" })}>
                <Printer /> Étiquette
              </Link>
              <a href={`/api/equipments/${equipment.id}/qr`} className={buttonVariants({ variant: "outline" })}>
                <Download /> SVG
              </a>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historique des interventions ({records.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Aucune intervention enregistrée.</p>
          ) : (
            <ol className="grid gap-3">
              {records.map((r) => (
                <li key={r.id} className="grid gap-1.5 rounded-lg border p-3 sm:grid-cols-[8rem_1fr_auto] sm:items-start sm:gap-4">
                  <div className="font-medium tabular-nums">{formatDateFr(r.performedAt)}</div>
                  <div className="grid gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{RECORD_TYPE_LABELS[r.type]}</span>
                      <ResultBadge result={r.statusResult} />
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Réalisé par {r.performedBy}
                      {r.authorName ? ` · saisi par ${r.authorName}` : ""}
                    </div>
                    {r.comments && <p className="text-sm whitespace-pre-line">{r.comments}</p>}
                  </div>
                  {r.certificateFileUrl && (
                    <a
                      href={`/api/certificates/${r.id}`}
                      target="_blank"
                      rel="noopener"
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <FileText /> {r.certificateFileName ?? "Certificat"}
                    </a>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
