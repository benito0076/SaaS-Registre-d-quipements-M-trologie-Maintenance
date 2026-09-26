import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRing, FileCheck2, Gauge, QrCode } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { buttonVariants } from "@/components/ui/button";
import { getAppLocale } from "@/i18n/server";
import { FREE_PLAN_EQUIPMENT_LIMIT } from "@/lib/plan";
import { getCurrentUser } from "@/lib/session";

export default async function Home() {
  if (await getCurrentUser()) redirect("/dashboard");
  const [t, locale] = await Promise.all([getTranslations(), getAppLocale()]);
  const features = [
    { icon: QrCode, title: t("landing.qrTitle"), text: t("landing.qrText") },
    { icon: BellRing, title: t("landing.alertsTitle"), text: t("landing.alertsText") },
    { icon: FileCheck2, title: t("landing.certTitle"), text: t("landing.certText") },
  ];
  return (
    <main className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-4">
        <span className="flex items-center gap-2 font-semibold">
          <Gauge className="size-5" /> {t("common.appName")}
        </span>
        <div className="flex items-center gap-1">
          <LocaleSwitcher locale={locale} label={t("common.language")} />
          <Link href="/login" className={buttonVariants({ variant: "ghost" })}>
            {t("landing.login")}
          </Link>
        </div>
      </header>
      <section className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{t("landing.title")}</h1>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">{t("landing.subtitle")}</p>
        <div className="flex justify-center gap-3">
          <Link href="/signup" className={buttonVariants({ size: "lg" })}>
            {t("landing.cta")}
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          {t("landing.pricing", { limit: FREE_PLAN_EQUIPMENT_LIMIT, price: t("billing.price") })}
        </p>
      </section>
      <section className="mx-auto grid w-full max-w-5xl gap-4 px-4 pb-16 md:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl border p-5">
            <f.icon className="mb-3 size-6" />
            <h2 className="font-semibold">{f.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
