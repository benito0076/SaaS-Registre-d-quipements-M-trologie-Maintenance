import type { EquipmentStatus, RecordResult } from "@/db/enums";
import { daysUntil, dueState, formatDateFr } from "@/lib/dates";
import { EQUIPMENT_STATUS_LABELS, RECORD_RESULT_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const pill = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";

/** Badge d'échéance : rouge si échu, orange si ≤ 30 jours, vert sinon. */
export function DueBadge({ date, today, className }: { date: string; today?: string; className?: string }) {
  const state = dueState(date, today);
  const days = daysUntil(date, today);
  const label =
    state === "overdue"
      ? `Échu (${-days} j)`
      : days === 0
        ? "Aujourd'hui"
        : state === "due_soon"
          ? `J-${days}`
          : "À jour";
  return (
    <span
      className={cn(
        pill,
        state === "overdue" && "bg-red-100 text-red-800",
        state === "due_soon" && (days <= 7 ? "bg-red-100 text-red-800" : "bg-orange-100 text-orange-800"),
        state === "ok" && "bg-green-100 text-green-800",
        className,
      )}
      title={`Échéance : ${formatDateFr(date)}`}
    >
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: EquipmentStatus | null }) {
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
      {EQUIPMENT_STATUS_LABELS[s]}
    </span>
  );
}

export function ResultBadge({ result }: { result: RecordResult }) {
  return (
    <span
      className={cn(
        pill,
        result === "conform" && "bg-green-100 text-green-800",
        result === "adjusted" && "bg-blue-100 text-blue-800",
        result === "non_conform" && "bg-red-100 text-red-800",
      )}
    >
      {RECORD_RESULT_LABELS[result]}
    </span>
  );
}
