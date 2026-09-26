import type { RecordResult } from "@/db/enums";
import { addMonths } from "./dates";

interface EquipmentDates {
  calibrationFrequencyMonths: number | null;
  lastCalibrationDate: string | null;
  nextCalibrationDate: string;
}

interface NewRecord {
  performedAt: string;
  statusResult: RecordResult;
}

/**
 * Règle §3.B : dès qu'une intervention conforme est validée,
 * next_calibration_date = performed_at + calibration_frequency_months.
 *
 * Retourne `null` si l'équipement ne doit pas être modifié :
 *  - résultat non « conform » ;
 *  - intervention antérieure au dernier étalonnage connu (saisie a posteriori
 *    d'un historique) — elle ne doit pas faire reculer l'échéance.
 */
export function computeCalibrationUpdate(
  equipment: EquipmentDates,
  record: NewRecord,
): { lastCalibrationDate: string; nextCalibrationDate: string } | null {
  if (record.statusResult !== "conform") return null;
  if (equipment.lastCalibrationDate && record.performedAt < equipment.lastCalibrationDate) {
    return null;
  }
  const months = equipment.calibrationFrequencyMonths ?? 12;
  return {
    lastCalibrationDate: record.performedAt,
    nextCalibrationDate: addMonths(record.performedAt, months),
  };
}
