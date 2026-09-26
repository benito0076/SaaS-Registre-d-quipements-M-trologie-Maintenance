import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, ForbiddenError, PlanLimitError } from "@/lib/errors";
import { createEquipment, getEquipment, getOrgUsage, listEquipments, suggestInternalId } from "@/server/equipments";
import { createRecord, listRecords } from "@/server/records";
import { addUser, createOrg, equipmentInput, resetDb, setPlan } from "./helpers";

describe("limite du plan gratuit (§3.E)", () => {
  beforeEach(resetDb);

  it("bloque la création du 16e équipement en plan gratuit", async () => {
    const org = await createOrg();
    for (let i = 0; i < 15; i++) await createEquipment(org, equipmentInput());
    await expect(createEquipment(org, equipmentInput())).rejects.toBeInstanceOf(PlanLimitError);
    expect((await getOrgUsage(org)).canCreate).toBe(false);
  });

  it("ne peut pas être contournée par des créations concurrentes", async () => {
    const org = await createOrg();
    for (let i = 0; i < 10; i++) await createEquipment(org, equipmentInput());
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => createEquipment(org, equipmentInput())));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    expect((await listEquipments(org)).length).toBe(15);
  });

  it("le plan Pro est illimité", async () => {
    const org = await createOrg();
    await setPlan(org.orgId, "pro");
    for (let i = 0; i < 17; i++) await createEquipment(org, equipmentInput());
    const usage = await getOrgUsage(org);
    expect(usage).toMatchObject({ equipmentCount: 17, planTier: "pro", limit: null, canCreate: true });
  });
});

describe("équipements et interventions", () => {
  beforeEach(resetDb);

  it("refuse un code interne en double dans l'organisation", async () => {
    const org = await createOrg();
    await createEquipment(org, equipmentInput({ internalId: "EQ-1" }));
    await expect(createEquipment(org, equipmentInput({ internalId: "EQ-1" }))).rejects.toBeInstanceOf(ConflictError);
  });

  it("un lecteur ne peut rien créer ; un technicien peut", async () => {
    const org = await createOrg();
    const viewer = await addUser(org.orgId, "viewer");
    const tech = await addUser(org.orgId, "technician");
    await expect(createEquipment(viewer, equipmentInput())).rejects.toBeInstanceOf(ForbiddenError);
    const eq = await createEquipment(tech, equipmentInput());
    await expect(
      createRecord(viewer, eq.id, { type: "preventive", performedAt: "2026-09-01", performedBy: "x", statusResult: "conform", comments: null }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("une intervention conforme recalcule la prochaine échéance", async () => {
    const org = await createOrg();
    const eq = await createEquipment(org, equipmentInput({ calibrationFrequencyMonths: 6, nextCalibrationDate: "2026-09-30" }));
    await createRecord(org, eq.id, {
      type: "calibration",
      performedAt: "2026-09-20",
      performedBy: "Labo COFRAC",
      statusResult: "conform",
      comments: null,
    });
    const updated = await getEquipment(org, eq.id);
    expect(updated.lastCalibrationDate).toBe("2026-09-20");
    expect(updated.nextCalibrationDate).toBe("2027-03-20");
  });

  it("une intervention non conforme ne change pas l'échéance mais est historisée", async () => {
    const org = await createOrg();
    const eq = await createEquipment(org, equipmentInput({ nextCalibrationDate: "2026-09-30" }));
    await createRecord(org, eq.id, {
      type: "calibration",
      performedAt: "2026-09-20",
      performedBy: "Labo",
      statusResult: "non_conform",
      comments: "Dérive hors tolérance",
    });
    expect((await getEquipment(org, eq.id)).nextCalibrationDate).toBe("2026-09-30");
    const history = await listRecords(org, eq.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ statusResult: "non_conform", authorName: expect.any(String) });
  });

  it("filtre et recherche côté serveur", async () => {
    const org = await createOrg();
    await createEquipment(org, equipmentInput({ internalId: "EQ-A", name: "Manomètre 100%", nextCalibrationDate: "2026-01-01" }));
    await createEquipment(org, equipmentInput({ internalId: "EQ-B", name: "Balance", status: "under_maintenance", nextCalibrationDate: "2026-10-10" }));
    await createEquipment(org, equipmentInput({ internalId: "EQ-C", name: "Étuve", nextCalibrationDate: "2027-06-01" }));
    const today = "2026-09-26";
    expect((await listEquipments(org, { filter: "overdue", today })).map((e) => e.internalId)).toEqual(["EQ-A"]);
    expect((await listEquipments(org, { filter: "due_soon", today })).map((e) => e.internalId)).toEqual(["EQ-B"]);
    expect((await listEquipments(org, { filter: "under_maintenance" })).map((e) => e.internalId)).toEqual(["EQ-B"]);
    expect((await listEquipments(org, { q: "100%" })).map((e) => e.internalId)).toEqual(["EQ-A"]);
    expect((await listEquipments(org, { q: "%" })).map((e) => e.internalId)).toEqual(["EQ-A"]);
    expect((await listEquipments(org, { sort: "internal_id", dir: "desc" })).map((e) => e.internalId)).toEqual(["EQ-C", "EQ-B", "EQ-A"]);
  });

  it("propose le code interne suivant", async () => {
    const org = await createOrg();
    expect(await suggestInternalId(org, 2026)).toBe("EQ-2026-001");
    await createEquipment(org, equipmentInput({ internalId: "EQ-2026-004" }));
    expect(await suggestInternalId(org, 2026)).toBe("EQ-2026-005");
  });
});
