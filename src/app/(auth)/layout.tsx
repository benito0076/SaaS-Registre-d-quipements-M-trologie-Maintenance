import Link from "next/link";
import { Gauge } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { getAppLocale } from "@/i18n/server";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [t, locale] = await Promise.all([getTranslations("common"), getAppLocale()]);
  return (
    <NextIntlClientProvider>
      <main className="flex flex-1 flex-col items-center justify-center bg-muted/40 px-4 py-10">
        <Link href="/" className="mb-6 flex items-center gap-2 text-lg font-semibold">
          <Gauge className="size-6" /> {t("appName")}
        </Link>
        <div className="w-full max-w-sm">{children}</div>
        <LocaleSwitcher locale={locale} label={t("language")} className="mt-6" />
      </main>
    </NextIntlClientProvider>
  );
}
