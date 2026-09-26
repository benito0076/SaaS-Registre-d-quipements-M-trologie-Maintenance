import { describe, expect, it, vi } from "vitest";
import { can } from "@/lib/permissions";
import { canCreateEquipment, FREE_PLAN_EQUIPMENT_LIMIT, planTierFromStripeStatus } from "@/lib/plan";
import { withRetry } from "@/lib/retry";
import { equipmentInputSchema, isUuid, recordInputSchema } from "@/lib/validation";

describe("plan", () => {
  it("bloque au-delà de 15 équipements en gratuit", () => {
    expect(FREE_PLAN_EQUIPMENT_LIMIT).toBe(15);
    expect(canCreateEquipment("free", 14)).toBe(true);
    expect(canCreateEquipment("free", 15)).toBe(false);
    expect(canCreateEquipment(null, 15)).toBe(false);
    expect(canCreateEquipment("pro", 5000)).toBe(true);
  });

  it("dérive le plan du statut Stripe", () => {
    expect(planTierFromStripeStatus("active")).toBe("pro");
    expect(planTierFromStripeStatus("trialing")).toBe("pro");
    expect(planTierFromStripeStatus("canceled")).toBe("free");
    expect(planTierFromStripeStatus("incomplete_expired")).toBe("free");
  });
});

describe("permissions", () => {
  it("applique la matrice des rôles", () => {
    expect(can("viewer", "equipment:write")).toBe(false);
    expect(can("viewer", "record:write")).toBe(false);
    expect(can("technician", "record:write")).toBe(true);
    expect(can("technician", "equipment:delete")).toBe(false);
    expect(can("technician", "billing:manage")).toBe(false);
    expect(can("admin", "team:manage")).toBe(true);
  });
});

describe("withRetry", () => {
  it("réessaie avec temporisation exponentielle puis réussit", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {});
    let calls = 0;
    const { value, attempts } = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw new Error("ECONNRESET");
        return "ok";
      },
      { retries: 3, baseDelayMs: 100, sleep },
    );
    expect(value).toBe("ok");
    expect(attempts).toBe(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([100, 200]);
  });

  it("abandonne après le nombre maximal d'essais", async () => {
    const fn = vi.fn(async () => {
      throw new Error("down");
    });
    await expect(withRetry(fn, { retries: 2, sleep: async () => {} })).rejects.toThrow("down");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("n'insiste pas sur une erreur non transitoire", async () => {
    const fn = vi.fn(async () => {
      throw new Error("invalid");
    });
    await expect(withRetry(fn, { retries: 5, shouldRetry: () => false, sleep: async () => {} })).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("validation", () => {
  it("exige code interne, nom, prochaine échéance et fréquence", () => {
    const r = equipmentInputSchema.safeParse({});
    expect(r.success).toBe(false);
    const keys = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(keys).toEqual(expect.arrayContaining(["internalId", "name", "nextCalibrationDate", "calibrationFrequencyMonths"]));
  });

  it("accepte un équipement minimal", () => {
    const r = equipmentInputSchema.parse({
      internalId: " EQ-2026-004 ",
      name: "Manomètre",
      calibrationFrequencyMonths: "12",
      nextCalibrationDate: "2027-01-01",
    });
    expect(r).toMatchObject({ internalId: "EQ-2026-004", calibrationFrequencyMonths: 12, status: "operational", brand: null });
  });

  it("valide les interventions", () => {
    expect(recordInputSchema.safeParse({ type: "calibration", performedAt: "2026-09-26", performedBy: "Labo X", statusResult: "conform" }).success).toBe(true);
    expect(recordInputSchema.safeParse({ type: "other", performedAt: "2026-09-26", performedBy: "Labo X", statusResult: "conform" }).success).toBe(false);
  });

  it("reconnaît les UUID", () => {
    expect(isUuid("7c9e6679-7425-40de-944b-e07fc1f90ae7")).toBe(true);
    expect(isUuid("1 OR 1=1")).toBe(false);
  });
});
