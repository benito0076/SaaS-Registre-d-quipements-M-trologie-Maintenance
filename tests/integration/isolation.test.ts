import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundError } from "@/lib/errors";
import {
  deleteEquipment,
  getEquipment,
  getEquipmentByQrToken,
  listEquipments,
  updateEquipment,
} from "@/server/equipments";
import { createEquipment } from "@/server/equipments";
import { createRecord, getCertificateForRecord, listRecords } from "@/server/records";
import { listTeam, removeTeamMember, updateTeamMemberRole } from "@/server/organizations";
import { getLabelEquipments } from "@/server/labels";
import { createOrg, equipmentInput, resetDb } from "./helpers";

const record = { type: "calibration", performedAt: "2026-09-01", performedBy: "Labo", statusResult: "conform", comments: null } as const;

describe("isolation multi-tenant (§3.A, §5)", () => {
  beforeEach(resetDb);

  async function setup() {
    const a = await createOrg("A");
    const b = await createOrg("B");
    const eqA = await createEquipment(a, equipmentInput({ internalId: "EQ-001" }));
    const eqB = await createEquipment(b, equipmentInput({ internalId: "EQ-001" }));
    const recB = await createRecord(b, eqB.id, record, { key: `certificates/${b.orgId}/x.pdf`, fileName: "x.pdf" });
    return { a, b, eqA, eqB, recB };
  }

  it("la liste ne contient que les équipements de l'organisation", async () => {
    const { a, eqA } = await setup();
    const list = await listEquipments(a);
    expect(list.map((e) => e.id)).toEqual([eqA.id]);
    expect(await getLabelEquipments(a, [])).toHaveLength(1);
  });

  it("un même code interne est permis dans deux organisations", async () => {
    const { eqA, eqB } = await setup();
    expect(eqA.internalId).toBe(eqB.internalId);
  });

  it("toute opération sur un équipement d'une autre organisation lève NotFound", async () => {
    const { a, eqB, recB } = await setup();
    await expect(getEquipment(a, eqB.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateEquipment(a, eqB.id, equipmentInput())).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteEquipment(a, eqB.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(listRecords(a, eqB.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(createRecord(a, eqB.id, record)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getCertificateForRecord(a, recB.id)).rejects.toBeInstanceOf(NotFoundError);
    expect(await getLabelEquipments(a, [eqB.id])).toHaveLength(0);
  });

  it("les identifiants malformés sont traités comme introuvables", async () => {
    const { a } = await setup();
    await expect(getEquipment(a, "1' OR '1'='1")).rejects.toBeInstanceOf(NotFoundError);
    expect(await getEquipmentByQrToken("not-a-uuid")).toBeNull();
  });

  it("les données de B restent intactes après les tentatives de A", async () => {
    const { a, b, eqB } = await setup();
    await updateEquipment(a, eqB.id, equipmentInput({ name: "Piraté" })).catch(() => {});
    await deleteEquipment(a, eqB.id).catch(() => {});
    const still = await getEquipment(b, eqB.id);
    expect(still.name).not.toBe("Piraté");
    expect(await listRecords(b, eqB.id)).toHaveLength(1);
  });

  it("la gestion d'équipe est cloisonnée", async () => {
    const { a, b } = await setup();
    expect((await listTeam(a)).every((m) => m.id !== b.userId)).toBe(true);
    await expect(updateTeamMemberRole(a, b.userId, "viewer")).rejects.toBeInstanceOf(NotFoundError);
    // removeTeamMember vérifie d'abord qu'un autre admin reste dans A, puis 404.
    await expect(removeTeamMember(a, b.userId)).rejects.toThrow();
    expect(await listTeam(b)).toHaveLength(1);
  });
});
