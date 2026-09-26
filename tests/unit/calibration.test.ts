import { describe, expect, it } from "vitest";
import { computeCalibrationUpdate } from "@/lib/calibration";

const equipment = { calibrationFrequencyMonths: 6, lastCalibrationDate: "2026-01-10", nextCalibrationDate: "2026-07-10" };

describe("recalcul de l'échéance (§3.B)", () => {
  it("next = performed_at + fréquence pour une intervention conforme", () => {
    expect(computeCalibrationUpdate(equipment, { performedAt: "2026-07-01", statusResult: "conform" })).toEqual({
      lastCalibrationDate: "2026-07-01",
      nextCalibrationDate: "2027-01-01",
    });
  });

  it("ne modifie rien si le résultat n'est pas conforme", () => {
    expect(computeCalibrationUpdate(equipment, { performedAt: "2026-07-01", statusResult: "non_conform" })).toBeNull();
    expect(computeCalibrationUpdate(equipment, { performedAt: "2026-07-01", statusResult: "adjusted" })).toBeNull();
  });

  it("ignore une intervention antérieure au dernier étalonnage", () => {
    expect(computeCalibrationUpdate(equipment, { performedAt: "2025-12-01", statusResult: "conform" })).toBeNull();
  });

  it("utilise 12 mois par défaut", () => {
    const r = computeCalibrationUpdate(
      { calibrationFrequencyMonths: null, lastCalibrationDate: null, nextCalibrationDate: "2026-01-01" },
      { performedAt: "2026-03-15", statusResult: "conform" },
    );
    expect(r?.nextCalibrationDate).toBe("2027-03-15");
  });
});
