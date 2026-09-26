import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantContext } from "@/lib/session";
import { createEquipment } from "@/server/equipments";
import { createRecord } from "@/server/records";
import { createOrg, equipmentInput, resetDb } from "./helpers";

// Simule le jeton de session : l'utilisateur courant est celui de `current`.
let current: TenantContext | null = null;
vi.mock("@/lib/session", () => ({ getCurrentUser: async () => current }));

const equipmentRoute = await import("@/app/api/equipments/[id]/route");
const recordsRoute = await import("@/app/api/equipments/[id]/records/route");
const listRoute = await import("@/app/api/equipments/route");
const certificateRoute = await import("@/app/api/certificates/[recordId]/route");
const qrRoute = await import("@/app/api/equipments/[id]/qr/route");

const params = <T,>(p: T) => ({ params: Promise.resolve(p) });
const req = (url: string, init?: RequestInit) => new Request(`https://app.example.com${url}`, init);

describe("API : isolation par organisation (critère d'acceptation §5)", () => {
  beforeEach(resetDb);

  async function setup() {
    const a = await createOrg("A");
    const b = await createOrg("B");
    const eqB = await createEquipment(b, equipmentInput());
    const recB = await createRecord(
      b,
      eqB.id,
      { type: "calibration", performedAt: "2026-09-01", performedBy: "Labo", statusResult: "conform", comments: null },
      { key: `certificates/${b.orgId}/secret.pdf`, fileName: "secret.pdf" },
    );
    current = { ...a, fullName: null, orgName: "A" };
    return { a, b, eqB, recB };
  }

  it("401 sans session", async () => {
    current = null;
    const res = await listRoute.GET(req("/api/equipments"), params({}));
    expect(res.status).toBe(401);
  });

  it("jeton A + ID d'équipement B → 404 sur toutes les méthodes (jamais 403)", async () => {
    const { eqB, recB } = await setup();
    const id = eqB.id;
    const responses = await Promise.all([
      equipmentRoute.GET(req(`/api/equipments/${id}`), params({ id })),
      equipmentRoute.PATCH(req(`/api/equipments/${id}`, { method: "PATCH", body: JSON.stringify({ name: "x" }) }), params({ id })),
      equipmentRoute.DELETE(req(`/api/equipments/${id}`, { method: "DELETE" }), params({ id })),
      recordsRoute.GET(req(`/api/equipments/${id}/records`), params({ id })),
      recordsRoute.POST(
        req(`/api/equipments/${id}/records`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type: "calibration", performedAt: "2026-09-02", performedBy: "x", statusResult: "conform" }),
        }),
        params({ id }),
      ),
      qrRoute.GET(req(`/api/equipments/${id}/qr`), params({ id })),
      certificateRoute.GET(req(`/api/certificates/${recB.id}`), params({ recordId: recB.id })),
    ]);
    expect(responses.map((r) => r.status)).toEqual([404, 404, 404, 404, 404, 404, 404]);
  });

  it("un identifiant inexistant et un identifiant d'une autre organisation sont indiscernables", async () => {
    const { eqB } = await setup();
    const foreign = await equipmentRoute.GET(req(`/api/equipments/${eqB.id}`), params({ id: eqB.id }));
    const missing = crypto.randomUUID();
    const unknown = await equipmentRoute.GET(req(`/api/equipments/${missing}`), params({ id: missing }));
    expect(foreign.status).toBe(unknown.status);
    expect(await foreign.json()).toEqual(await unknown.json());
  });

  it("la liste de A n'expose aucun équipement de B", async () => {
    await setup();
    const res = await listRoute.GET(req("/api/equipments"), params({}));
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual([]);
  });

  it("A peut créer et modifier ses propres équipements", async () => {
    await setup();
    const created = await listRoute.POST(
      req("/api/equipments", {
        method: "POST",
        body: JSON.stringify({ internalId: "EQ-A-1", name: "Balance", calibrationFrequencyMonths: 12, nextCalibrationDate: "2027-01-01" }),
      }),
      params({}),
    );
    expect(created.status).toBe(201);
    const { data } = await created.json();
    const patched = await equipmentRoute.PATCH(
      req(`/api/equipments/${data.id}`, { method: "PATCH", body: JSON.stringify({ location: "Atelier" }) }),
      params({ id: data.id }),
    );
    expect(patched.status).toBe(200);
    expect((await patched.json()).data).toMatchObject({ location: "Atelier", name: "Balance" });
  });
});

describe("API : messages d'erreur localisés", () => {
  beforeEach(resetDb);

  it("répond dans la langue demandée", async () => {
    const a = await createOrg("A");
    current = { ...a, fullName: null, orgName: "A" };
    const id = crypto.randomUUID();
    const fr = await equipmentRoute.GET(req(`/api/equipments/${id}`), params({ id }));
    const en = await equipmentRoute.GET(req(`/api/equipments/${id}`, { headers: { "accept-language": "en-US" } }), params({ id }));
    const es = await equipmentRoute.GET(req(`/api/equipments/${id}`, { headers: { cookie: "NEXT_LOCALE=es" } }), params({ id }));
    expect((await fr.json()).error).toBe("Ressource introuvable");
    expect((await en.json()).error).toBe("Resource not found");
    expect((await es.json()).error).toBe("Recurso no encontrado");

    const bad = await listRoute.POST(
      req("/api/equipments", { method: "POST", headers: { "accept-language": "en" }, body: JSON.stringify({ name: "x" }) }),
      params({}),
    );
    expect(bad.status).toBe(400);
    expect((await bad.json()).fieldErrors.internalId).toEqual(["Required field"]);
  });
});
