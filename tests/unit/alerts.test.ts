import { describe, expect, it } from "vitest";
import { alertLevelFor, renderAlertEmail, type AlertItem } from "@/lib/alerts";

const today = "2026-09-26";

describe("niveaux d'alerte (§3.D)", () => {
  it("J-30, J-7, J-0 et échu au jour exact", () => {
    expect(alertLevelFor("2026-10-26", today)).toBe("j30");
    expect(alertLevelFor("2026-10-03", today)).toBe("j7");
    expect(alertLevelFor("2026-09-26", today)).toBe("j0");
    expect(alertLevelFor("2026-09-25", today)).toBe("overdue");
    expect(alertLevelFor("2025-01-01", today)).toBe("overdue");
  });

  it("aucune alerte hors seuils", () => {
    for (const d of ["2026-10-25", "2026-10-27", "2026-10-02", "2026-10-04", "2026-09-27", "2027-01-01"]) {
      expect(alertLevelFor(d, today)).toBeNull();
    }
  });

  it("rattrape les seuils franchis pendant des jours sans exécution", () => {
    // Dernière exécution le 23 → since = 24 : on couvre les 24, 25 et 26.
    expect(alertLevelFor("2026-10-24", today, "2026-09-24")).toBe("j30"); // J-30 le 24
    expect(alertLevelFor("2026-10-01", today, "2026-09-24")).toBe("j7"); // J-7 le 24
    expect(alertLevelFor("2026-10-23", today, "2026-09-24")).toBeNull(); // J-30 le 23, déjà traité
  });
});

describe("gabarit e-mail", () => {
  const items: AlertItem[] = [
    { equipmentId: "e1", internalId: "EQ-1", name: "Balance <test>", location: "Labo", nextCalibrationDate: "2026-10-26", level: "j30", daysLeft: 30 },
    { equipmentId: "e2", internalId: "EQ-2", name: "Pied à coulisse", location: null, nextCalibrationDate: "2026-09-20", level: "overdue", daysLeft: -6 },
    { equipmentId: "e3", internalId: "EQ-3", name: "Thermomètre", location: null, nextCalibrationDate: "2026-10-03", level: "j7", daysLeft: 7 },
  ];
  const mail = renderAlertEmail({ orgName: "ACME", appUrl: "https://app.example.com", items });

  it("liste les équipements avec lien direct et badge coloré", () => {
    expect(mail.html).toContain("https://app.example.com/equipments/e1");
    expect(mail.html).toContain("https://app.example.com/equipments/e2");
    expect(mail.html).toContain("#f97316"); // orange J-30
    expect(mail.html).toContain("#dc2626"); // rouge J-7 / échu
    expect(mail.html).toContain("Balance &lt;test&gt;");
    expect(mail.html).not.toContain("Balance <test>");
  });

  it("trie échus d'abord et le signale dans le sujet", () => {
    expect(mail.subject).toContain("1 équipement échu");
    expect(mail.text.indexOf("EQ-2")).toBeLessThan(mail.text.indexOf("EQ-3"));
    expect(mail.text.indexOf("EQ-3")).toBeLessThan(mail.text.indexOf("EQ-1"));
  });
});
