/** Valeurs énumérées (sans dépendance à l'ORM : utilisables côté client). */

export const USER_ROLES = ["admin", "technician", "viewer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const EQUIPMENT_STATUSES = [
  "operational",
  "under_maintenance",
  "out_of_service",
] as const;
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];

export const RECORD_TYPES = ["calibration", "preventive", "corrective"] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export const RECORD_RESULTS = ["conform", "non_conform", "adjusted"] as const;
export type RecordResult = (typeof RECORD_RESULTS)[number];

export const PLAN_TIERS = ["free", "pro"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];
