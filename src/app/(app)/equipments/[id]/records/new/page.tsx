import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createRecordAction } from "@/app/actions/equipments";
import { DueBadge } from "@/components/badges";
import { formatDateFr, todayIso } from "@/lib/dates";
import { orNotFound } from "@/lib/not-found";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { ACCEPTED_UPLOAD_TYPES } from "@/lib/storage";
import { getEquipment } from "@/server/equipments";
import { RecordForm } from "./record-form";

export const metadata: Metadata = { title: "Nouvelle intervention" };

export default async function NewRecordPage({ params }: PageProps<"/equipments/[id]/records/new">) {
  const { id } = await params;
  const user = await requireUser(`/equipments/${id}/records/new`);
  const equipment = await orNotFound(getEquipment(user, id));
  if (!can(user.role, "record:write")) redirect(`/equipments/${id}`);

  return (
    <div className="mx-auto grid max-w-lg gap-4">
      <div>
        <div className="font-mono text-sm text-muted-foreground">{equipment.internalId}</div>
        <h1 className="text-xl font-semibold">{equipment.name}</h1>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
          Échéance actuelle : {formatDateFr(equipment.nextCalibrationDate)}
          <DueBadge date={equipment.nextCalibrationDate} />
        </div>
      </div>
      <RecordForm
        action={createRecordAction.bind(null, equipment.id)}
        cancelHref={`/equipments/${equipment.id}`}
        today={todayIso()}
        defaultPerformedBy={user.fullName ?? user.email}
        accept={ACCEPTED_UPLOAD_TYPES}
        frequencyMonths={equipment.calibrationFrequencyMonths ?? 12}
      />
    </div>
  );
}
