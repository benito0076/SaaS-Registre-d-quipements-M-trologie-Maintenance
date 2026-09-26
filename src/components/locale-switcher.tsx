"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";
import { setLocaleAction } from "@/app/actions/auth";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** Sélecteur de langue : enregistre le cookie NEXT_LOCALE puis rafraîchit la page. */
export function LocaleSwitcher({ locale, label, className }: { locale: Locale; label: string; className?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className={cn("relative inline-flex items-center text-sm text-muted-foreground", className)}>
      <Languages className="pointer-events-none absolute left-2 size-4" aria-hidden />
      <span className="sr-only">{label}</span>
      <select
        value={locale}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(async () => {
            await setLocaleAction(next);
            router.refresh();
          });
        }}
        className="h-8 appearance-none rounded-md border border-transparent bg-transparent pr-2 pl-7 hover:border-input focus-visible:border-ring focus-visible:outline-none"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
