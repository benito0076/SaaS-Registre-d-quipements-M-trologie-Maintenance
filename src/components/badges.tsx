"use client";

import { useLocale, useTranslations } from "next-intl";
import type { EquipmentStatus, RecordResult } from "@/db/enums";
import { daysUntil, dueState, formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

const pill = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

/** Badge d'échéance : rouge si échu ou ≤ 7 jours, orange si ≤ 30 jours, vert sinon. */
export function DueBadge({ date, today, className }: { date: string; today?: string; className?: string }) {
  const t = useTranslations("due");
  const locale = useLocale();
  const state = dueState(date, today);
  const days = daysUntil(date, today);
  const label =
    state === "overdue"
      ? t("overdue", { days: -days })
      : days === 0
        ? t("today")
        : state === "due_soon"
          ? t("soon", { days })
          : t("ok");
  return (
    <span
      className={cn(
        pill,
        state === "overdue" && "bg-red-100 text-red-800",
        state === "due_soon" && (days <= 7 ? "bg-red-100 text-red-800" : "bg-orange-100 text-orange-800"),
        state === "ok" && "bg-green-100 text-green-800",
        className,
      )}
      title={t("tooltip", { date: formatDate(date, locale) })}
    >
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: EquipmentStatus | null }) {
  const t = useTranslations("equipmentStatus");
  const s = status ?? "operational";
  return (
    <span
      className={cn(
        pill,
        s === "operational" && "bg-slate-100 text-slate-700",
        s === "under_maintenance" && "bg-amber-100 text-amber-800",
        s === "out_of_service" && "bg-zinc-800 text-white",
      )}
    >
      {t(s)}
    </span>
  );
}

export function ResultBadge({ result }: { result: RecordResult }) {
  const t = useTranslations("recordResult");
  return (
    <span
      className={cn(
        pill,
        result === "conform" && "bg-green-100 text-green-800",
        result === "adjusted" && "bg-blue-100 text-blue-800",
        result === "non_conform" && "bg-red-100 text-red-800",
      )}
    >
      {t(result)}
    </span>
  );
}
