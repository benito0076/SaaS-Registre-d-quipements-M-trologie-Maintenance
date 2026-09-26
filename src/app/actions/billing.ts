"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { createCheckoutSession, createPortalSession } from "@/server/billing";
import { toActionState, type ActionState } from "./state";

/** Redirige vers Stripe Checkout (plan Pro). */
export async function checkoutAction(): Promise<ActionState> {
  const ctx = await requireUser();
  if (!isStripeConfigured()) return { error: "Le paiement n'est pas configuré sur cette instance." };
  let url: string;
  try {
    url = await createCheckoutSession(getStripe(), ctx, ctx.email);
  } catch (e) {
    return toActionState(e);
  }
  redirect(url);
}

export async function portalAction(): Promise<ActionState> {
  const ctx = await requireUser();
  if (!isStripeConfigured()) return { error: "Le paiement n'est pas configuré sur cette instance." };
  let url: string | null;
  try {
    url = await createPortalSession(getStripe(), ctx);
  } catch (e) {
    return toActionState(e);
  }
  if (!url) return { error: "Aucun abonnement Stripe associé." };
  redirect(url);
}
