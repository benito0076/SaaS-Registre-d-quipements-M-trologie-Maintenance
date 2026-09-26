import type { UserRole } from "@/db/enums";
import { ForbiddenError } from "./errors";

/**
 * Matrice des droits :
 *  - viewer     : lecture seule ;
 *  - technician : + création/modification d'équipements et d'interventions ;
 *  - admin      : + suppression, gestion de l'équipe et facturation.
 */
export type Permission =
  | "equipment:write"
  | "equipment:delete"
  | "record:write"
  | "team:manage"
  | "billing:manage";

const MATRIX: Record<UserRole, ReadonlySet<Permission>> = {
  viewer: new Set(),
  technician: new Set(["equipment:write", "record:write"]),
  admin: new Set([
    "equipment:write",
    "equipment:delete",
    "record:write",
    "team:manage",
    "billing:manage",
  ]),
};

export function can(role: UserRole, permission: Permission): boolean {
  return MATRIX[role]?.has(permission) ?? false;
}

export function assertCan(role: UserRole, permission: Permission): void {
  if (!can(role, permission)) throw new ForbiddenError();
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrateur",
  technician: "Technicien",
  viewer: "Lecteur",
};
