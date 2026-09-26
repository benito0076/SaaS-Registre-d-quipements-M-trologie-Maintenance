"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction } from "@/app/actions/auth";
import { Field, FormError, SubmitButton } from "@/components/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function SignupForm() {
  const [state, action] = useActionState(signupAction, {});
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <Card>
      <CardHeader>
        <CardTitle>Créer un compte</CardTitle>
        <CardDescription>Plan gratuit : jusqu&apos;à 15 équipements, sans carte bancaire.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <FormError message={state.fieldErrors ? undefined : state.error} />
          <Field label="Nom de l'entreprise" htmlFor="companyName" required error={fe.companyName}>
            <Input id="companyName" name="companyName" required autoComplete="organization" defaultValue={v.companyName} />
          </Field>
          <Field label="Votre nom" htmlFor="fullName" error={fe.fullName}>
            <Input id="fullName" name="fullName" autoComplete="name" defaultValue={v.fullName} />
          </Field>
          <Field label="E-mail professionnel" htmlFor="email" required error={fe.email}>
            <Input id="email" name="email" type="email" required autoComplete="email" defaultValue={v.email} />
          </Field>
          <Field label="Mot de passe" htmlFor="password" required error={fe.password} hint="10 caractères minimum">
            <Input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" />
          </Field>
          <SubmitButton size="lg">Créer mon organisation</SubmitButton>
          <p className="text-center text-sm text-muted-foreground">
            Déjà inscrit ?{" "}
            <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
              Se connecter
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
