import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateFr } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { FREE_PLAN_EQUIPMENT_LIMIT, PRO_PLAN_PRICE_LABEL } from "@/lib/plan";
import { requireUser } from "@/lib/session";
import { isStripeConfigured } from "@/lib/stripe";
import { getSubscription } from "@/server/billing";
import { getOrgUsage } from "@/server/equipments";
import { CheckoutButton, PortalButton } from "./billing-buttons";

export const metadata: Metadata = { title: "Abonnement" };

export default async function BillingPage({ searchParams }: PageProps<"/billing">) {
  const user = await requireUser("/billing");
  if (!can(user.role, "billing:manage")) redirect("/dashboard");
  const { checkout } = await searchParams;
  const [sub, usage] = await Promise.all([getSubscription(user), getOrgUsage(user)]);
  const isPro = usage.planTier === "pro";
  const configured = isStripeConfigured();

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <h1 className="text-xl font-semibold">Abonnement</h1>
      {checkout === "success" && (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          Paiement confirmé. L&apos;activation du plan Pro peut prendre quelques secondes.
        </p>
      )}
      {checkout === "canceled" && (
        <p className="rounded-lg border bg-muted px-3 py-2 text-sm">Paiement annulé : aucun montant n&apos;a été débité.</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Plan actuel : {isPro ? "Pro" : "Gratuit"}</CardTitle>
          <CardDescription>
            {usage.equipmentCount} équipement{usage.equipmentCount > 1 ? "s" : ""}
            {usage.limit ? ` sur ${usage.limit} autorisés` : " (illimité)"}
            {isPro && sub?.currentPeriodEnd && ` · prochaine échéance le ${formatDateFr(sub.currentPeriodEnd.toISOString().slice(0, 10))}`}
            {sub?.status && sub.status !== "active" && ` · statut Stripe : ${sub.status}`}
          </CardDescription>
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
            <CardTitle>Gratuit</CardTitle>
            <CardDescription>0 €</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-1.5 text-sm">
            <Feature>Jusqu&apos;à {FREE_PLAN_EQUIPMENT_LIMIT} équipements</Feature>
            <Feature>QR codes et étiquettes</Feature>
            <Feature>Alertes e-mail</Feature>
          </CardContent>
        </Card>
        <Card className="ring-2 ring-foreground">
          <CardHeader>
            <CardTitle>Pro</CardTitle>
            <CardDescription>{PRO_PLAN_PRICE_LABEL}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="grid gap-1.5">
              <Feature>Équipements illimités</Feature>
              <Feature>QR codes et étiquettes</Feature>
              <Feature>Alertes e-mail</Feature>
            </div>
            {!configured ? (
              <p className="text-xs text-muted-foreground">Le paiement Stripe n&apos;est pas configuré sur cette instance.</p>
            ) : isPro ? (
              <PortalButton />
            ) : (
              <CheckoutButton />
            )}
          </CardContent>
        </Card>
      </div>
      {configured && !isPro && sub?.stripeCustomerId && (
        <div className="justify-self-start">
          <PortalButton label="Factures et moyens de paiement" />
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
