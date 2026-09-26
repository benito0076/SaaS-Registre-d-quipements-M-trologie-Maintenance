import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { updateEquipmentAction } from "@/app/actions/equipments";
import { orNotFound } from "@/lib/not-found";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { getEquipment } from "@/server/equipments";
import { EquipmentForm } from "../../equipment-form";

export const metadata: Metadata = { title: "Modifier l'équipement" };

export default async function EditEquipmentPage({ params }: PageProps<"/equipments/[id]/edit">) {
  const { id } = await params;
  const user = await requireUser(`/equipments/${id}/edit`);
  if (!can(user.role, "equipment:write")) redirect(`/equipments/${id}`);
  const e = await orNotFound(getEquipment(user, id));
  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <h1 className="text-xl font-semibold">Modifier {e.internalId}</h1>
      <EquipmentForm
        action={updateEquipmentAction.bind(null, e.id)}
        submitLabel="Enregistrer"
        cancelHref={`/equipments/${e.id}`}
        canManageBilling={can(user.role, "billing:manage")}
        defaults={{
          internalId: e.internalId,
          name: e.name,
          brand: e.brand ?? "",
          model: e.model ?? "",
          serialNumber: e.serialNumber ?? "",
          location: e.location ?? "",
          status: e.status ?? "operational",
          calibrationFrequencyMonths: String(e.calibrationFrequencyMonths ?? 12),
          lastCalibrationDate: e.lastCalibrationDate ?? "",
          nextCalibrationDate: e.nextCalibrationDate,
        }}
      />
    </div>
  );
}
