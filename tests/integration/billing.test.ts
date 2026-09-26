import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { applyStripeSubscription, handleStripeEvent } from "@/server/billing";
import { createEquipment, getOrgUsage } from "@/server/equipments";
import { createOrg, equipmentInput, resetDb } from "./helpers";

function fakeSub(over: Partial<Record<string, unknown>> & { id: string; status: string; orgId?: string; customer?: string }) {
  return {
    id: over.id,
    status: over.status,
    customer: over.customer ?? "cus_123",
    metadata: over.orgId ? { org_id: over.orgId } : {},
    items: { data: [{ current_period_end: 1_800_000_000 }] },
  } as unknown as Stripe.Subscription;
}

describe("synchronisation Stripe (§3.E)", () => {
  beforeEach(resetDb);

  it("active puis résilie le plan Pro", async () => {
    const org = await createOrg();
    for (let i = 0; i < 15; i++) await createEquipment(org, equipmentInput());
    expect((await getOrgUsage(org)).canCreate).toBe(false);

    await applyStripeSubscription(fakeSub({ id: "sub_1", status: "active", orgId: org.orgId }));
    const [row] = await db.select().from(subscriptions).where(eq(subscriptions.orgId, org.orgId));
    expect(row).toMatchObject({ planTier: "pro", status: "active", stripeSubscriptionId: "sub_1", stripeCustomerId: "cus_123" });
    expect(row.currentPeriodEnd?.toISOString()).toBe(new Date(1_800_000_000_000).toISOString());
    expect((await getOrgUsage(org)).canCreate).toBe(true);

    await applyStripeSubscription(fakeSub({ id: "sub_1", status: "canceled" }));
    expect((await getOrgUsage(org)).planTier).toBe("free");
  });

  it("un ancien abonnement résilié ne rétrograde pas l'abonnement courant", async () => {
    const org = await createOrg();
    await applyStripeSubscription(fakeSub({ id: "sub_new", status: "active", orgId: org.orgId }));
    await applyStripeSubscription(fakeSub({ id: "sub_old", status: "canceled", orgId: org.orgId }));
    expect((await getOrgUsage(org)).planTier).toBe("pro");
  });

  it("relit l'abonnement depuis l'API lors d'un webhook (ordre des événements)", async () => {
    const org = await createOrg();
    const stripe = {
      subscriptions: { retrieve: async (id: string) => fakeSub({ id, status: "canceled", orgId: org.orgId }) },
    } as unknown as Stripe;
    await applyStripeSubscription(fakeSub({ id: "sub_1", status: "active", orgId: org.orgId }));
    // Un événement "updated" périmé (active) arrive après la résiliation : l'état réel l'emporte.
    await handleStripeEvent(stripe, {
      type: "customer.subscription.updated",
      data: { object: fakeSub({ id: "sub_1", status: "active", orgId: org.orgId }) },
    } as unknown as Stripe.Event);
    expect((await getOrgUsage(org)).planTier).toBe("free");
  });
});
