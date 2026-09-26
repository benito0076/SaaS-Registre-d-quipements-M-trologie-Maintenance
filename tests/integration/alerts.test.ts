import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { alertDispatches, cronRuns } from "@/db/schema";
import { EmailError, type EmailMessage, type EmailSender } from "@/lib/email";
import { runExpirationCheck } from "@/server/alert-engine";
import { createEquipment } from "@/server/equipments";
import { addUser, createOrg, equipmentInput, resetDb, setPlan } from "./helpers";

class FakeSender implements EmailSender {
  sent: EmailMessage[] = [];
  failures: Error[] = [];
  async send(m: EmailMessage) {
    const f = this.failures.shift();
    if (f) throw f;
    this.sent.push(m);
    return { id: `msg_${this.sent.length}` };
  }
}

const NOW = new Date("2026-09-26T06:00:00Z");
const noSleep = async () => {};
const silent = () => {};

function run(sender: EmailSender, now = NOW) {
  return runExpirationCheck({ sender, appUrl: "https://app.example.com", now, sleep: noSleep, log: silent });
}

describe("moteur d'alertes (§3.D, §5 « zéro oubli »)", () => {
  beforeEach(resetDb);

  async function seed() {
    const a = await createOrg("A");
    await setPlan(a.orgId, "pro");
    const tech = await addUser(a.orgId, "technician");
    const viewer = await addUser(a.orgId, "viewer");
    const b = await createOrg("B");
    const dates: Record<string, string> = {
      "A-J30": "2026-10-26",
      "A-J7": "2026-10-03",
      "A-J0": "2026-09-26",
      "A-OVER": "2026-08-01",
      "A-J29": "2026-10-25",
      "A-FAR": "2027-09-26",
    };
    for (const [internalId, next] of Object.entries(dates)) {
      await createEquipment(a, equipmentInput({ internalId, nextCalibrationDate: next }));
    }
    await createEquipment(b, equipmentInput({ internalId: "B-OVER", nextCalibrationDate: "2026-09-01" }));
    await createOrg("C-sans-alerte");
    return { a, b, tech, viewer };
  }

  it("un e-mail récapitulatif par organisation, aux admins et techniciens uniquement", async () => {
    const { a, b, tech, viewer } = await seed();
    const sender = new FakeSender();
    const summary = await run(sender);

    expect(summary).toMatchObject({ status: "success", organizationsWithAlerts: 2, emailsSent: 2, emailsFailed: 0, equipmentAlerts: 5 });
    expect(sender.sent).toHaveLength(2);

    const mailA = sender.sent.find((m) => m.to.includes(a.email))!;
    expect(mailA.to.sort()).toEqual([a.email, tech.email].sort());
    expect(mailA.to).not.toContain(viewer.email);
    for (const code of ["A-J30", "A-J7", "A-J0", "A-OVER"]) expect(mailA.text).toContain(code);
    for (const code of ["A-J29", "A-FAR", "B-OVER"]) expect(mailA.text).not.toContain(code);

    const mailB = sender.sent.find((m) => m.to.includes(b.email))!;
    expect(mailB.text).toContain("B-OVER");
    expect(mailB.text).not.toContain("A-");

    const [log] = await db.select().from(cronRuns).where(eq(cronRuns.id, summary.runId));
    expect(log).toMatchObject({ status: "success", emailsSent: 2, emailsFailed: 0, organizationsProcessed: 2 });
    expect(log.finishedAt).not.toBeNull();
  });

  it("une seconde exécution le même jour n'envoie pas de doublon", async () => {
    await seed();
    const sender = new FakeSender();
    await run(sender);
    const second = await run(sender, new Date("2026-09-26T09:00:00Z"));
    expect(sender.sent).toHaveLength(2);
    expect(second).toMatchObject({ alreadySent: 2, emailsSent: 0 });
  });

  it("réessaie en cas d'erreur réseau transitoire", async () => {
    await seed();
    const sender = new FakeSender();
    sender.failures.push(new Error("ECONNRESET"), new EmailError("rate_limit_exceeded: slow down", true));
    const summary = await run(sender);
    expect(summary).toMatchObject({ status: "success", emailsSent: 2 });
    const dispatches = await db.select().from(alertDispatches);
    expect(dispatches.map((d) => d.attempts).sort()).toEqual([1, 3]);
  });

  it("consigne l'échec puis le reprend à l'exécution suivante", async () => {
    await seed();
    const sender = new FakeSender();
    sender.failures.push(...Array.from({ length: 4 }, () => new Error("network down")));
    const first = await run(sender);
    expect(first).toMatchObject({ status: "partial", emailsSent: 1, emailsFailed: 1 });
    const failed = await db.select().from(alertDispatches).where(eq(alertDispatches.status, "failed"));
    expect(failed).toHaveLength(1);
    expect(failed[0].lastError).toContain("network down");

    const retry = await run(sender, new Date("2026-09-26T07:00:00Z"));
    expect(retry).toMatchObject({ status: "success", emailsSent: 1, alreadySent: 1 });
    expect(sender.sent).toHaveLength(2);
  });

  it("n'insiste pas sur une erreur définitive (validation)", async () => {
    await seed();
    const sender = new FakeSender();
    sender.failures.push(new EmailError("validation_error: bad from", false));
    const summary = await run(sender);
    expect(summary.emailsFailed).toBe(1);
    const [failed] = await db.select().from(alertDispatches).where(eq(alertDispatches.status, "failed"));
    expect(failed.attempts).toBe(1);
  });

  it("rattrape un seuil J-30 franchi un jour où le cron n'a pas tourné", async () => {
    const a = await createOrg("A");
    await createEquipment(a, equipmentInput({ internalId: "MISSED", nextCalibrationDate: "2026-10-25" }));
    const sender = new FakeSender();
    // Exécution le 24 (rien à signaler), pas d'exécution le 25, exécution le 26.
    await run(sender, new Date("2026-09-24T06:00:00Z"));
    expect(sender.sent).toHaveLength(0);
    await run(sender, new Date("2026-09-26T06:00:00Z"));
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].text).toContain("MISSED");
  });

  it("rattrape les envois échoués des jours précédents", async () => {
    const a = await createOrg("A");
    await createEquipment(a, equipmentInput({ internalId: "J30-HIER", nextCalibrationDate: "2026-10-25" }));
    const sender = new FakeSender();
    sender.failures.push(...Array.from({ length: 4 }, () => new Error("down")));
    await run(sender, new Date("2026-09-25T06:00:00Z")); // J-30 : échec
    await run(sender, new Date("2026-09-26T06:00:00Z")); // J-29 : rattrapage
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].text).toContain("J30-HIER");
    const rows = await db.select().from(alertDispatches);
    expect(rows.map((r) => r.status).sort()).toEqual(["sent", "superseded"]);
  });
});
