"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
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
import { FREE_PLAN_EQUIPMENT_LIMIT } from "@/lib/plan";

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
  const t = useTranslations("upgrade");
  const tb = useTranslations("billing");
  const [state, action] = useActionState(async () => checkoutAction(), {});
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-amber-500" /> {t("title")}
          </DialogTitle>
          <DialogDescription>
            {t("description", { limit: FREE_PLAN_EQUIPMENT_LIMIT })}
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">{t("plan")}</span>
            <span className="text-lg font-bold">{tb("price")}</span>
          </div>
          <ul className="mt-3 grid gap-1.5 text-sm">
            {[t("featureUnlimited"), t("featureAlerts"), t("featureCertificates")].map(
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
            <SubmitButton size="lg">{t("cta")}</SubmitButton>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("askAdmin")}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
