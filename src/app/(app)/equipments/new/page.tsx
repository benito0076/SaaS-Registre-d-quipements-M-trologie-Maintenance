import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { createEquipmentAction } from "@/app/actions/equipments";
import { pageTitle } from "@/i18n/metadata";
import { addMonths, todayIso } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { suggestInternalId } from "@/server/equipments";
import { EquipmentForm } from "../equipment-form";

export const generateMetadata = pageTitle("newEquipment");

export default async function NewEquipmentPage() {
  const user = await requireUser("/equipments/new");
  if (!can(user.role, "equipment:write")) redirect("/dashboard");
  const [internalId, t] = await Promise.all([suggestInternalId(user), getTranslations("equipmentForm")]);
  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <h1 className="text-xl font-semibold">{t("newTitle")}</h1>
      <EquipmentForm
        action={createEquipmentAction}
        submitLabel={t("create")}
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
