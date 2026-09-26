"use server";

import { revalidatePath } from "next/cache";
import { USER_ROLES, type UserRole } from "@/db/schema";
import { ValidationError } from "@/lib/errors";
import { requireUser } from "@/lib/session";
import { parseOrThrow, teamMemberSchema } from "@/lib/validation";
import { addTeamMember, removeTeamMember, updateTeamMemberRole } from "@/server/organizations";
import { toActionState, type ActionState } from "./state";

export async function addMemberAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  try {
    const input = parseOrThrow(teamMemberSchema, {
      fullName: form.get("fullName") || undefined,
      email: form.get("email"),
      role: form.get("role"),
      password: form.get("password"),
    });
    await addTeamMember(ctx, input);
  } catch (e) {
    return toActionState(e, form);
  }
  revalidatePath("/team");
  return { ok: true };
}

export async function changeRoleAction(userId: string, form: FormData): Promise<ActionState> {
  const ctx = await requireUser();
  try {
    const role = form.get("role") as UserRole;
    if (!USER_ROLES.includes(role)) throw new ValidationError("Rôle invalide");
    await updateTeamMemberRole(ctx, userId, role);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath("/team");
  return { ok: true };
}

export async function removeMemberAction(userId: string): Promise<ActionState> {
  const ctx = await requireUser();
  try {
    await removeTeamMember(ctx, userId);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath("/team");
  return { ok: true };
}
