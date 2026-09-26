"use client";

import { useActionState } from "react";
import { Check, Sparkles } from "lucide-react";
import { checkoutAction } from "@/app/actions/billing";
import { FormError, SubmitButton } from "@/components/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FREE_PLAN_EQUIPMENT_LIMIT, PRO_PLAN_PRICE_LABEL } from "@/lib/plan";

/** Modale d'upgrade affichée lorsque la limite du plan gratuit est atteinte (§3.E). */
export function UpgradeDialog({
  open,
  onOpenChange,
  canManageBilling,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManageBilling: boolean;
}) {
  const [state, action] = useActionState(async () => checkoutAction(), {});
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-amber-500" /> Limite du plan gratuit atteinte
          </DialogTitle>
          <DialogDescription>
            Le plan gratuit est limité à {FREE_PLAN_EQUIPMENT_LIMIT} équipements. Passez au plan Pro pour
            continuer à enrichir votre registre.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">Plan Pro</span>
            <span className="text-lg font-bold">{PRO_PLAN_PRICE_LABEL}</span>
          </div>
          <ul className="mt-3 grid gap-1.5 text-sm">
            {["Équipements illimités", "Alertes e-mail J-30 / J-7 / échéance", "Certificats et historique illimités"].map(
              (f) => (
                <li key={f} className="flex items-center gap-2">
                  <Check className="size-4 text-green-600" /> {f}
                </li>
              ),
            )}
          </ul>
        </div>
        {canManageBilling ? (
          <form action={action} className="grid gap-2">
            <FormError message={state.error} />
            <SubmitButton size="lg">Passer au plan Pro</SubmitButton>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            Demandez à un administrateur de votre organisation de souscrire au plan Pro.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
