"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { parseOrThrow, signupSchema } from "@/lib/validation";
import { signupOrganization } from "@/server/organizations";
import { toActionState, type ActionState } from "./state";

/** N'accepte que des chemins internes pour éviter les redirections ouvertes. */
function safeCallback(value: FormDataEntryValue | null): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/dashboard";
}

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirectTo: safeCallback(form.get("callbackUrl")),
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "E-mail ou mot de passe incorrect", values: { email: String(form.get("email") ?? "") } };
    }
    throw e; // la redirection de succès est une exception interne à Next.js
  }
}

export async function signupAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const input = parseOrThrow(signupSchema, {
      companyName: form.get("companyName"),
      fullName: form.get("fullName") || undefined,
      email: form.get("email"),
      password: form.get("password"),
    });
    await signupOrganization(input);
    await signIn("credentials", {
      email: input.email,
      password: input.password,
      redirectTo: "/dashboard",
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof AuthError) return { error: "Connexion impossible après inscription" };
    return toActionState(e, form);
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
