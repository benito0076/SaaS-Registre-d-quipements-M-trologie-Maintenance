import type { PlanTier } from "@/db/enums";

/** Plan gratuit : 15 équipements maximum par organisation (§3.E). */
export const FREE_PLAN_EQUIPMENT_LIMIT = 15;

export const PRO_PLAN_PRICE_LABEL = "49 € / mois";

/** Statuts Stripe pour lesquels l'abonnement Pro donne accès aux fonctionnalités. */
const ACTIVE_STRIPE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function planTierFromStripeStatus(status: string): PlanTier {
  return ACTIVE_STRIPE_STATUSES.has(status) ? "pro" : "free";
}

export function canCreateEquipment(planTier: PlanTier | null | undefined, count: number): boolean {
  if (planTier === "pro") return true;
  return count < FREE_PLAN_EQUIPMENT_LIMIT;
}

/** Code renvoyé par l'API / les actions lorsque la limite est atteinte. */
export const PLAN_LIMIT_CODE = "PLAN_LIMIT_REACHED";
