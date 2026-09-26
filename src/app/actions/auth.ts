"use server";

import { cookies } from "next/headers";
import { AuthError } from "next-auth";
import { getTranslations } from "next-intl/server";
import { isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { signIn, signOut } from "@/auth";
import { parseOrThrow, signupSchema } from "@/lib/validation";
import { signupOrganization } from "@/server/organizations";
import { currentLocale, toActionState, type ActionState } from "./state";

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
      const t = await getTranslations("errors");
      return { error: t("invalidCredentials"), values: { email: String(form.get("email") ?? "") } };
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
    // La langue d'interface au moment de l'inscription devient celle des e-mails d'alerte.
    await signupOrganization({ ...input, locale: await currentLocale() });
    await signIn("credentials", {
      email: input.email,
      password: input.password,
      redirectTo: "/dashboard",
    });
    return { ok: true };
  } catch (e) {
    if (e instanceof AuthError) return { error: (await getTranslations("errors"))("signupLoginFailed") };
    return await toActionState(e, form);
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

/** Change la langue d'interface (cookie valable un an). */
export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
