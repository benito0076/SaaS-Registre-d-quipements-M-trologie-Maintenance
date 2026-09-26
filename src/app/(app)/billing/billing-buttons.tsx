"use client";

import { useActionState } from "react";
import { checkoutAction, portalAction } from "@/app/actions/billing";
import { FormError, SubmitButton } from "@/components/form";

export function CheckoutButton({ label }: { label: string }) {
  const [state, action] = useActionState(async () => checkoutAction(), {});
  return (
    <form action={action} className="grid gap-2">
      <FormError message={state.error} />
      <SubmitButton size="lg">{label}</SubmitButton>
    </form>
  );
}

export function PortalButton({ label }: { label: string }) {
  const [state, action] = useActionState(async () => portalAction(), {});
  return (
    <form action={action} className="grid gap-2">
      <FormError message={state.error} />
      <SubmitButton size="lg" variant="outline">
        {label}
      </SubmitButton>
    </form>
  );
}
