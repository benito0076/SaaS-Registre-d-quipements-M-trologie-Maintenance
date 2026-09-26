"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { FREE_PLAN_EQUIPMENT_LIMIT } from "@/lib/plan";
import { signupAction } from "@/app/actions/auth";
import { Field, FormError, SubmitButton } from "@/components/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function SignupForm() {
  const t = useTranslations("auth");
  const [state, action] = useActionState(signupAction, {});
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("signupTitle")}</CardTitle>
        <CardDescription>{t("signupDescription", { limit: FREE_PLAN_EQUIPMENT_LIMIT })}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <FormError message={state.fieldErrors ? undefined : state.error} />
          <Field label={t("companyName")} htmlFor="companyName" required error={fe.companyName}>
            <Input id="companyName" name="companyName" required autoComplete="organization" defaultValue={v.companyName} />
          </Field>
          <Field label={t("fullName")} htmlFor="fullName" error={fe.fullName}>
            <Input id="fullName" name="fullName" autoComplete="name" defaultValue={v.fullName} />
          </Field>
          <Field label={t("workEmail")} htmlFor="email" required error={fe.email}>
            <Input id="email" name="email" type="email" required autoComplete="email" defaultValue={v.email} />
          </Field>
          <Field label={t("password")} htmlFor="password" required error={fe.password} hint={t("passwordHint")}>
            <Input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" />
          </Field>
          <SubmitButton size="lg">{t("signupSubmit")}</SubmitButton>
          <p className="text-center text-sm text-muted-foreground">
            {t("alreadyRegistered")}{" "}
            <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
              {t("signIn")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
