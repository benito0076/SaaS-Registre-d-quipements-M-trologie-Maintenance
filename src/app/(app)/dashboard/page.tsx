import type { Metadata } from "next";
import { AlertTriangle, CalendarClock, Package, Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { dueState, todayIso } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";
import { getOrgUsage, listEquipments } from "@/server/equipments";
import { InventoryTable } from "./inventory-table";

export const metadata: Metadata = { title: "Inventaire" };

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const today = todayIso();
  const [items, usage] = await Promise.all([listEquipments(user), getOrgUsage(user)]);

  const overdue = items.filter((e) => dueState(e.nextCalibrationDate, today) === "overdue").length;
  const soon = items.filter((e) => dueState(e.nextCalibrationDate, today) === "due_soon").length;
  const maintenance = items.filter((e) => e.status === "under_maintenance").length;

  const stats = [
    {
      label: "Équipements",
      value: usage.limit ? `${items.length} / ${usage.limit}` : items.length,
      icon: Package,
      className: "",
    },
    { label: "Échus", value: overdue, icon: AlertTriangle, className: overdue ? "text-red-600" : "" },
    { label: "Échéance ≤ 30 j", value: soon, icon: CalendarClock, className: soon ? "text-orange-600" : "" },
    { label: "En révision", value: maintenance, icon: Wrench, className: "" },
  ];

  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} size="sm">
            <CardContent className="flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
                <div className={`text-2xl font-semibold ${s.className}`}>{s.value}</div>
              </div>
              <s.icon className={`size-5 text-muted-foreground ${s.className}`} />
            </CardContent>
          </Card>
        ))}
      </div>
      <InventoryTable
        items={items.map((e) => ({
          id: e.id,
          internalId: e.internalId,
          name: e.name,
          brand: e.brand,
          model: e.model,
          serialNumber: e.serialNumber,
          location: e.location,
          status: e.status ?? "operational",
          nextCalibrationDate: e.nextCalibrationDate,
        }))}
        today={today}
        canWrite={can(user.role, "equipment:write")}
        canCreate={usage.canCreate}
        canManageBilling={can(user.role, "billing:manage")}
      />
    </div>
  );
}
