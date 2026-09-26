"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Printer, Search } from "lucide-react";
import type { EquipmentStatus } from "@/db/enums";
import { DueBadge, StatusBadge } from "@/components/badges";
import { selectClass } from "@/components/form";
import { UpgradeDialog } from "@/components/upgrade-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dueState, formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export interface InventoryItem {
  id: string;
  internalId: string;
  name: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  location: string | null;
  status: EquipmentStatus;
  nextCalibrationDate: string;
}

type Filter = "all" | "operational" | "overdue" | "due_soon" | "under_maintenance" | "out_of_service";
type SortKey = "internalId" | "name" | "location" | "nextCalibrationDate" | "status";

const FILTERS = [
  { value: "all", key: "filterAll" },
  { value: "operational", key: "filterOperational" },
  { value: "overdue", key: "filterOverdue" },
  { value: "due_soon", key: "filterDueSoon" },
  { value: "under_maintenance", key: "filterMaintenance" },
  { value: "out_of_service", key: "filterOutOfService" },
] as const satisfies readonly { value: Filter; key: string }[];

function SortHeader({
  k,
  sort,
  onSort,
  children,
}: {
  k: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (k: SortKey) => void;
  children: React.ReactNode;
}) {
  const Icon = sort.key !== k ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
  return (
    <TableHead aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        <Icon className={cn("size-3.5", sort.key !== k && "opacity-40")} />
      </button>
    </TableHead>
  );
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function InventoryTable({
  items,
  today,
  canWrite,
  canCreate,
  canManageBilling,
}: {
  items: InventoryItem[];
  today: string;
  canWrite: boolean;
  canCreate: boolean;
  canManageBilling: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "nextCalibrationDate", dir: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: items.length,
      operational: 0,
      overdue: 0,
      due_soon: 0,
      under_maintenance: 0,
      out_of_service: 0,
    };
    for (const i of items) {
      c[i.status]++;
      const d = dueState(i.nextCalibrationDate, today);
      if (d === "overdue") c.overdue++;
      if (d === "due_soon") c.due_soon++;
    }
    return c;
  }, [items, today]);

  const rows = useMemo(() => {
    const q = normalize(query.trim());
    const filtered = items.filter((i) => {
      if (filter === "overdue" && dueState(i.nextCalibrationDate, today) !== "overdue") return false;
      if (filter === "due_soon" && dueState(i.nextCalibrationDate, today) !== "due_soon") return false;
      if (
        (filter === "operational" || filter === "under_maintenance" || filter === "out_of_service") &&
        i.status !== filter
      )
        return false;
      if (!q) return true;
      return normalize(
        [i.internalId, i.name, i.brand, i.model, i.serialNumber, i.location].filter(Boolean).join(" "),
      ).includes(q);
    });
    return filtered.sort((a, b) => {
      const av = a[sort.key] ?? "";
      const bv = b[sort.key] ?? "";
      return av.localeCompare(bv, locale, { numeric: true }) * sort.dir;
    });
  }, [items, query, filter, sort, today, locale]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  function toggleAll() {
    setSelected((s) => {
      const next = new Set(s);
      if (allVisibleSelected) rows.forEach((r) => next.delete(r.id));
      else rows.forEach((r) => next.add(r.id));
      return next;
    });
  }

  const labelsHref = `/labels?ids=${[...selected].join(",")}`;

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <div className="flex flex-1 flex-col gap-2 sm:flex-row md:justify-end">
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t("searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
              aria-label={t("searchLabel")}
            />
          </div>
          <select
            className={cn(selectClass, "sm:hidden")}
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            aria-label={t("filterLabel")}
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {t(f.key)} ({counts[f.value]})
              </option>
            ))}
          </select>
          {selected.size > 0 && (
            <Link href={labelsHref} className={buttonVariants({ variant: "outline" })}>
              <Printer /> {t("labelsSelected", { count: selected.size })}
            </Link>
          )}
          {canWrite &&
            (canCreate ? (
              <Link href="/equipments/new" className={buttonVariants()}>
                <Plus /> {t("newEquipment")}
              </Link>
            ) : (
              <Button onClick={() => setUpgradeOpen(true)}>
                <Plus /> {t("newEquipment")}
              </Button>
            ))}
        </div>
      </div>

      <div className="hidden flex-wrap gap-1.5 sm:flex" role="tablist" aria-label={t("filters")}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              filter === f.value ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted",
            )}
          >
            {t(f.key)} <span className="opacity-70">({counts[f.value]})</span>
          </button>
        ))}
      </div>

      <Card className="py-0">
        {/* Vue tableau (≥ md) */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <input type="checkbox" aria-label={t("selectAll")} checked={allVisibleSelected} onChange={toggleAll} />
                </TableHead>
                <SortHeader k="internalId" sort={sort} onSort={toggleSort}>{t("colCode")}</SortHeader>
                <SortHeader k="name" sort={sort} onSort={toggleSort}>{t("colEquipment")}</SortHeader>
                <SortHeader k="location" sort={sort} onSort={toggleSort}>{t("colLocation")}</SortHeader>
                <SortHeader k="status" sort={sort} onSort={toggleSort}>{t("colStatus")}</SortHeader>
                <SortHeader k="nextCalibrationDate" sort={sort} onSort={toggleSort}>{t("colNextDue")}</SortHeader>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((i) => (
                <TableRow key={i.id} className="cursor-pointer" onClick={() => router.push(`/equipments/${i.id}`)}>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={t("select", { id: i.internalId })} checked={selected.has(i.id)} onChange={() => toggle(i.id)} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/equipments/${i.id}`} onClick={(e) => e.stopPropagation()}>
                      {i.internalId}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{i.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[i.brand, i.model].filter(Boolean).join(" ") || "—"}
                    </div>
                  </TableCell>
                  <TableCell>{i.location ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge status={i.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums">{formatDate(i.nextCalibrationDate, locale)}</span>
                      <DueBadge date={i.nextCalibrationDate} today={today} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Vue cartes (mobile) */}
        <ul className="divide-y md:hidden">
          {rows.map((i) => (
            <li key={i.id} className="flex items-start gap-3 p-3">
              <input type="checkbox" className="mt-1" aria-label={t("select", { id: i.internalId })} checked={selected.has(i.id)} onChange={() => toggle(i.id)} />
              <Link href={`/equipments/${i.id}`} className="grid flex-1 gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{i.internalId}</span>
                  <DueBadge date={i.nextCalibrationDate} today={today} />
                </div>
                <div className="font-medium">{i.name}</div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{i.location ?? "—"}</span>
                  <span>{t("dueOn", { date: formatDate(i.nextCalibrationDate, locale) })}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {rows.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {items.length === 0 ? t("empty") : t("noMatch")}
          </div>
        )}
      </Card>

      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} canManageBilling={canManageBilling} />
    </div>
  );
}
