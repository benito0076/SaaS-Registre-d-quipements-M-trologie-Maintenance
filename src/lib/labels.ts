import type { EquipmentStatus, RecordResult, RecordType } from "@/db/enums";

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  operational: "Opérationnel",
  under_maintenance: "En révision",
  out_of_service: "Hors service",
};

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  calibration: "Étalonnage",
  preventive: "Maintenance préventive",
  corrective: "Maintenance corrective",
};

export const RECORD_RESULT_LABELS: Record<RecordResult, string> = {
  conform: "Conforme",
  non_conform: "Non conforme",
  adjusted: "Ajusté",
};
