"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { addMemberAction, changeRoleAction, removeMemberAction, updateSettingsAction } from "@/app/actions/team";
import type { ActionState } from "@/app/actions/state";
import { USER_ROLES, type UserRole } from "@/db/enums";
import { Field, FormError, SubmitButton, selectClass } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/config";

export function AddMemberForm() {
  const t = useTranslations();
  const [state, action] = useActionState(addMemberAction, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  const fe = state.fieldErrors ?? {};
  return (
    <form ref={ref} action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FormError message={state.fieldErrors ? undefined : state.error} />
        {state.ok && <p className="text-sm text-green-700">{t("team.added")}</p>}
      </div>
      <Field label={t("team.name")} htmlFor="m-fullName" error={fe.fullName}>
        <Input id="m-fullName" name="fullName" />
      </Field>
      <Field label={t("team.email")} htmlFor="m-email" required error={fe.email}>
        <Input id="m-email" name="email" type="email" required />
      </Field>
      <Field label={t("team.role")} htmlFor="m-role" required error={fe.role}>
        <select id="m-role" name="role" className={selectClass} defaultValue="technician">
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("team.tempPassword")} htmlFor="m-password" required error={fe.password} hint={t("team.passwordHint")}>
        <Input id="m-password" name="password" type="password" minLength={10} required autoComplete="new-password" />
      </Field>
      <div className="sm:col-span-2 sm:justify-self-end">
        <SubmitButton>{t("team.add")}</SubmitButton>
      </div>
    </form>
  );
}

export function MemberActions({ userId, role }: { userId: string; role: UserRole }) {
  const t = useTranslations();
  const [roleState, roleAction] = useActionState<ActionState, FormData>(
    (_prev, form) => changeRoleAction(userId, form),
    {},
  );
  const [removeState, removeAction] = useActionState<ActionState, FormData>(
    () => removeMemberAction(userId),
    {},
  );
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-2">
        <form action={roleAction}>
          <select
            name="role"
            className={`${selectClass} w-40`}
            defaultValue={role}
            aria-label={t("team.role")}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          >
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`roles.${r}`)}
              </option>
            ))}
          </select>
        </form>
        <form
          action={removeAction}
          onSubmit={(e) => {
            if (!confirm(t("team.removeConfirm"))) e.preventDefault();
          }}
        >
          <Button type="submit" variant="ghost" size="icon" aria-label={t("team.remove")}>
            <Trash2 />
          </Button>
        </form>
      </div>
      {(roleState.error || removeState.error) && (
        <p className="text-xs text-red-600">{roleState.error ?? removeState.error}</p>
      )}
    </div>
  );
}

export function OrgSettingsForm({ locale }: { locale: Locale }) {
  const t = useTranslations("team");
  const tc = useTranslations("common");
  const [state, action] = useActionState(updateSettingsAction, {});
  return (
    <form action={action} className="grid gap-4 sm:max-w-sm">
      <FormError message={state.error} />
      <Field label={t("alertLanguage")} htmlFor="org-locale" hint={t("alertLanguageHint")} error={state.fieldErrors?.locale}>
        <select id="org-locale" name="locale" className={selectClass} defaultValue={locale}>
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {LOCALE_NAMES[l]}
            </option>
          ))}
        </select>
      </Field>
      {state.ok && <p className="text-sm text-green-700">{t("settingsSaved")}</p>}
      <div className="sm:justify-self-start">
        <SubmitButton>{tc("save")}</SubmitButton>
      </div>
    </form>
  );
}
