import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { handleStripeEvent } from "@/server/billing";

export const dynamic = "force-dynamic";

/**
 * Webhook Stripe : customer.subscription.created / updated / deleted et
 * checkout.session.completed. La signature est vérifiée sur le corps brut.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }
  const stripe = getStripe();
  const payload = await request.text();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }
  try {
    await handleStripeEvent(stripe, event);
  } catch (e) {
    console.error(`[stripe] échec du traitement de ${event.type} (${event.id})`, e);
    // 500 => Stripe renverra l'événement plus tard.
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
