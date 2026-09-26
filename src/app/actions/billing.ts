"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/session";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createCheckoutSession, createPortalSession } from "@/server/billing";
import { toActionState, type ActionState } from "./state";

/** Redirige vers Stripe Checkout (plan Pro). */
export async function checkoutAction(): Promise<ActionState> {
  const ctx = await requireUser();
  if (!isStripeConfigured()) return { error: (await getTranslations("errors"))("billingNotConfigured") };
  let url: string;
  try {
    url = await createCheckoutSession(getStripe(), ctx, ctx.email);
  } catch (e) {
    return await toActionState(e);
  }
  redirect(url);
}

export async function portalAction(): Promise<ActionState> {
  const ctx = await requireUser();
  if (!isStripeConfigured()) return { error: (await getTranslations("errors"))("billingNotConfigured") };
  let url: string | null;
  try {
    url = await createPortalSession(getStripe(), ctx);
  } catch (e) {
    return await toActionState(e);
  }
  if (!url) return { error: (await getTranslations("errors"))("noStripeCustomer") };
  redirect(url);
}
