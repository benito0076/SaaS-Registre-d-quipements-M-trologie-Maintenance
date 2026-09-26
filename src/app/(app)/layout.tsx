import Link from "next/link";
import { Gauge, LogOut } from "lucide-react";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { logoutAction } from "@/app/actions/auth";
import { AppNav } from "@/components/app-nav";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { getAppLocale } from "@/i18n/server";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [t, locale] = await Promise.all([getTranslations(), getAppLocale()]);
  const links = [
    { href: "/dashboard", label: t("nav.inventory") },
    { href: "/labels", label: t("nav.labels") },
    { href: "/team", label: t("nav.team") },
    ...(can(user.role, "billing:manage") ? [{ href: "/billing", label: t("nav.billing") }] : []),
  ];
  return (
    <NextIntlClientProvider>
      <div className="flex min-h-full flex-1 flex-col bg-muted/30">
        <header className="no-print sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <Gauge className="size-5" />
              <span className="hidden sm:inline">{t("common.appName")}</span>
            </Link>
            <AppNav links={links} />
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden text-right text-xs leading-tight md:block">
                <div className="font-medium">{user.orgName}</div>
                <div className="text-muted-foreground">
                  {user.fullName ?? user.email} · {t(`roles.${user.role}`)}
                </div>
              </div>
              <LocaleSwitcher locale={locale} label={t("common.language")} />
              <form action={logoutAction}>
                <Button type="submit" variant="ghost" size="icon" aria-label={t("common.logout")} title={t("common.logout")}>
                  <LogOut />
                </Button>
              </form>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      </div>
    </NextIntlClientProvider>
  );
}
