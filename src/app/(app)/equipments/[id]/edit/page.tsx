import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { updateEquipmentAction } from "@/app/actions/equipments";
import { pageTitle } from "@/i18n/metadata";
import { orNotFound } from "@/lib/not-found";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { getEquipment } from "@/server/equipments";
import { EquipmentForm } from "../../equipment-form";

export const generateMetadata = pageTitle("editEquipment");

export default async function EditEquipmentPage({ params }: PageProps<"/equipments/[id]/edit">) {
  const { id } = await params;
  const user = await requireUser(`/equipments/${id}/edit`);
  if (!can(user.role, "equipment:write")) redirect(`/equipments/${id}`);
  const [e, t] = await Promise.all([orNotFound(getEquipment(user, id)), getTranslations("equipmentForm")]);
  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <h1 className="text-xl font-semibold">{t("editTitle", { id: e.internalId })}</h1>
      <EquipmentForm
        action={updateEquipmentAction.bind(null, e.id)}
        submitLabel={t("save")}
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
