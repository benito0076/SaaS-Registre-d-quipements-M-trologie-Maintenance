import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createEquipmentAction } from "@/app/actions/equipments";
import { addMonths, todayIso } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { suggestInternalId } from "@/server/equipments";
import { EquipmentForm } from "../equipment-form";

export const metadata: Metadata = { title: "Nouvel équipement" };

export default async function NewEquipmentPage() {
  const user = await requireUser("/equipments/new");
  if (!can(user.role, "equipment:write")) redirect("/dashboard");
  const internalId = await suggestInternalId(user);
  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <h1 className="text-xl font-semibold">Nouvel équipement</h1>
      <EquipmentForm
        action={createEquipmentAction}
        submitLabel="Créer l'équipement"
        cancelHref="/dashboard"
        canManageBilling={can(user.role, "billing:manage")}
        defaults={{
          internalId,
          name: "",
          brand: "",
          model: "",
          serialNumber: "",
          location: "",
          status: "operational",
          calibrationFrequencyMonths: "12",
          lastCalibrationDate: "",
          nextCalibrationDate: addMonths(todayIso(), 12),
        }}
      />
    </div>
  );
}
