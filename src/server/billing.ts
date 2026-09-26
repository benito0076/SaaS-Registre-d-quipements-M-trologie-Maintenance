import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, subscriptions, type Subscription } from "@/db/schema";
import { appUrl } from "@/lib/email";
import { assertCan } from "@/lib/permissions";
import { planTierFromStripeStatus } from "@/lib/plan";
import type { Ctx } from "./context";

export async function getSubscription(ctx: Ctx): Promise<Subscription | null> {
  const [row] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, ctx.orgId))
    .limit(1);
  return row ?? null;
}

async function ensureCustomer(stripe: Stripe, ctx: Ctx, email: string): Promise<string> {
  const existing = await getSubscription(ctx);
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;
  const [org] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, ctx.orgId))
    .limit(1);
  const customer = await stripe.customers.create(
    { name: org?.name, email, metadata: { org_id: ctx.orgId } },
    { idempotencyKey: `customer/${ctx.orgId}` },
  );
  await db
    .insert(subscriptions)
    .values({ orgId: ctx.orgId, stripeCustomerId: customer.id, planTier: "free", status: "active" })
    .onConflictDoUpdate({
      target: subscriptions.orgId,
      set: { stripeCustomerId: customer.id },
    });
  return customer.id;
}

/** Crée une session Stripe Checkout pour le plan Pro (49 €/mois). */
export async function createCheckoutSession(
  stripe: Stripe,
  ctx: Ctx,
  email: string,
): Promise<string> {
  assertCan(ctx.role, "billing:manage");
  const price = process.env.STRIPE_PRO_PRICE_ID;
  if (!price) throw new Error("STRIPE_PRO_PRICE_ID n'est pas défini");
  const customer = await ensureCustomer(stripe, ctx, email);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: ctx.orgId,
    line_items: [{ price, quantity: 1 }],
    subscription_data: { metadata: { org_id: ctx.orgId } },
    metadata: { org_id: ctx.orgId },
    allow_promotion_codes: true,
    success_url: `${appUrl()}/billing?checkout=success`,
    cancel_url: `${appUrl()}/billing?checkout=canceled`,
  });
  if (!session.url) throw new Error("Stripe n'a pas renvoyé d'URL de paiement");
  return session.url;
}

/** Portail client Stripe (moyen de paiement, factures, résiliation). */
export async function createPortalSession(stripe: Stripe, ctx: Ctx): Promise<string | null> {
  assertCan(ctx.role, "billing:manage");
  const sub = await getSubscription(ctx);
  if (!sub?.stripeCustomerId) return null;
  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${appUrl()}/billing`,
  });
  return session.url;
}

function periodEnd(sub: Stripe.Subscription): Date | null {
  const ends = sub.items.data.map((i) => i.current_period_end).filter((n) => typeof n === "number");
  return ends.length ? new Date(Math.max(...ends) * 1000) : null;
}

async function resolveOrgId(sub: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = sub.metadata?.org_id;
  if (fromMetadata) return fromMetadata;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const [row] = await db
    .select({ orgId: subscriptions.orgId })
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, customerId))
    .limit(1);
  return row?.orgId ?? null;
}

/** Synchronise la table subscriptions à partir de l'état d'un abonnement Stripe. */
export async function applyStripeSubscription(sub: Stripe.Subscription): Promise<void> {
  const orgId = await resolveOrgId(sub);
  if (!orgId) {
    console.warn(`[stripe] organisation introuvable pour l'abonnement ${sub.id}`);
    return;
  }
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const planTier = planTierFromStripeStatus(sub.status);

  const [current] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .limit(1);
  // Un ancien abonnement résilié ne doit pas rétrograder un abonnement plus récent.
  if (
    current?.stripeSubscriptionId &&
    current.stripeSubscriptionId !== sub.id &&
    current.planTier === "pro" &&
    planTier === "free"
  ) {
    return;
  }

  const values = {
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    planTier,
    status: sub.status,
    currentPeriodEnd: periodEnd(sub),
  };
  await db
    .insert(subscriptions)
    .values({ orgId, ...values })
    .onConflictDoUpdate({ target: subscriptions.orgId, set: values });
}

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

/**
 * Traite un événement webhook. L'abonnement est relu depuis l'API Stripe pour
 * rester correct même si les événements arrivent dans le désordre.
 */
export async function handleStripeEvent(stripe: Stripe, event: Stripe.Event): Promise<void> {
  if (SUBSCRIPTION_EVENTS.has(event.type)) {
    const sub = event.data.object as Stripe.Subscription;
    const fresh = await stripe.subscriptions.retrieve(sub.id);
    // L'objet de l'événement porte les métadonnées d'origine si l'API ne les renvoie plus.
    if (!fresh.metadata?.org_id && sub.metadata?.org_id) fresh.metadata = sub.metadata;
    await applyStripeSubscription(fresh);
    return;
  }
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "subscription" || !session.subscription) return;
    const subId =
      typeof session.subscription === "string" ? session.subscription : session.subscription.id;
    const fresh = await stripe.subscriptions.retrieve(subId);
    if (!fresh.metadata?.org_id && session.client_reference_id) {
      fresh.metadata = { ...fresh.metadata, org_id: session.client_reference_id };
    }
    await applyStripeSubscription(fresh);
  }
}
