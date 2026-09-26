"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { loginAction } from "@/app/actions/auth";
import { Field, FormError, SubmitButton } from "@/components/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState(loginAction, {});
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("loginTitle")}</CardTitle>
        <CardDescription>{t("loginDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <FormError message={state.error} />
          <Field label={t("email")} htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.values?.email} />
          </Field>
          <Field label={t("password")} htmlFor="password">
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
          </Field>
          <SubmitButton size="lg">{t("loginSubmit")}</SubmitButton>
          <p className="text-center text-sm text-muted-foreground">
            {t("noAccount")}{" "}
            <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
              {t("createAccount")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
