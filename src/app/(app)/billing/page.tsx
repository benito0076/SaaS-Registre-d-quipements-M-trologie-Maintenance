import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pageTitle } from "@/i18n/metadata";
import { getAppLocale } from "@/i18n/server";
import { formatDate } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { FREE_PLAN_EQUIPMENT_LIMIT } from "@/lib/plan";
import { requireUser } from "@/lib/session";
import { isStripeConfigured } from "@/lib/stripe";
import { getSubscription } from "@/server/billing";
import { getOrgUsage } from "@/server/equipments";
import { CheckoutButton, PortalButton } from "./billing-buttons";

export const generateMetadata = pageTitle("billing");

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const user = await requireUser("/billing");
  if (!can(user.role, "billing:manage")) redirect("/dashboard");
  const { checkout } = await searchParams;
  const [sub, usage, t, locale] = await Promise.all([
    getSubscription(user),
    getOrgUsage(user),
    getTranslations("billing"),
    getAppLocale(),
  ]);
  const isPro = usage.planTier === "pro";
  const configured = isStripeConfigured();

  const description = [
    t("usage", { count: usage.equipmentCount }),
    usage.limit ? t("usageLimit", { limit: usage.limit }) : t("usageUnlimited"),
    isPro && sub?.currentPeriodEnd
      ? t("renewal", { date: formatDate(sub.currentPeriodEnd.toISOString().slice(0, 10), locale) })
      : "",
    sub?.status && sub.status !== "active" ? t("stripeStatus", { status: sub.status }) : "",
  ].join("");

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      {checkout === "success" && (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {t("checkoutSuccess")}
        </p>
      )}
      {checkout === "canceled" && <p className="rounded-lg border bg-muted px-3 py-2 text-sm">{t("checkoutCanceled")}</p>}

      <Card>
        <CardHeader>
          <CardTitle>{t("currentPlan", { plan: isPro ? t("planPro") : t("planFree") })}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        {usage.limit && (
          <CardContent>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full ${usage.canCreate ? "bg-foreground" : "bg-red-600"}`}
                style={{ width: `${Math.min(100, (usage.equipmentCount / usage.limit) * 100)}%` }}
              />
            </div>
          </CardContent>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("free")}</CardTitle>
            <CardDescription>{t("freePrice")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1.5 text-sm">
            <Feature>{t("featureLimit", { limit: FREE_PLAN_EQUIPMENT_LIMIT })}</Feature>
            <Feature>{t("featureQr")}</Feature>
            <Feature>{t("featureAlerts")}</Feature>
          </CardContent>
        </Card>
        <Card className="ring-2 ring-foreground">
          <CardHeader>
            <CardTitle>{t("planPro")}</CardTitle>
            <CardDescription>{t("price")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="grid gap-1.5">
              <Feature>{t("featureUnlimited")}</Feature>
              <Feature>{t("featureQr")}</Feature>
              <Feature>{t("featureAlerts")}</Feature>
            </div>
            {!configured ? (
              <p className="text-xs text-muted-foreground">{t("notConfigured")}</p>
            ) : isPro ? (
              <PortalButton label={t("manage")} />
            ) : (
              <CheckoutButton label={t("upgrade")} />
            )}
          </CardContent>
        </Card>
      </div>
      {configured && !isPro && sub?.stripeCustomerId && (
        <div className="justify-self-start">
          <PortalButton label={t("invoices")} />
        </div>
      )}
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Check className="size-4 text-green-600" /> {children}
    </div>
  );
}
