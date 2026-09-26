"use client";

import { useActionState, useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { addMemberAction, changeRoleAction, removeMemberAction } from "@/app/actions/team";
import type { ActionState } from "@/app/actions/state";
import { USER_ROLES, type UserRole } from "@/db/enums";
import { Field, FormError, SubmitButton, selectClass } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_LABELS } from "@/lib/permissions";

export function AddMemberForm() {
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
        {state.ok && <p className="text-sm text-green-700">Membre ajouté. Communiquez-lui son mot de passe provisoire.</p>}
      </div>
      <Field label="Nom" htmlFor="m-fullName" error={fe.fullName}>
        <Input id="m-fullName" name="fullName" />
      </Field>
      <Field label="E-mail" htmlFor="m-email" required error={fe.email}>
        <Input id="m-email" name="email" type="email" required />
      </Field>
      <Field label="Rôle" htmlFor="m-role" required error={fe.role}>
        <select id="m-role" name="role" className={selectClass} defaultValue="technician">
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Mot de passe provisoire" htmlFor="m-password" required error={fe.password} hint="10 caractères minimum">
        <Input id="m-password" name="password" type="password" minLength={10} required autoComplete="new-password" />
      </Field>
      <div className="sm:col-span-2 sm:justify-self-end">
        <SubmitButton>Ajouter</SubmitButton>
      </div>
    </form>
  );
}

export function MemberActions({ userId, role }: { userId: string; role: UserRole }) {
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
            aria-label="Rôle"
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
          >
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </form>
        <form
          action={removeAction}
          onSubmit={(e) => {
            if (!confirm("Retirer ce membre de l'organisation ?")) e.preventDefault();
          }}
        >
          <Button type="submit" variant="ghost" size="icon" aria-label="Retirer le membre">
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
