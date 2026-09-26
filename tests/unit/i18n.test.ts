import { describe, expect, it } from "vitest";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import fr from "../../messages/fr.json";
import { negotiateLocale } from "@/i18n/config";
import { translateAppError } from "@/i18n/errors";
import { localeFromRequest } from "@/i18n/request-locale";
import { renderAlertEmail, type AlertItem } from "@/lib/alerts";
import { formatDate } from "@/lib/dates";
import { NotFoundError, PlanLimitError, ValidationError } from "@/lib/errors";
import { equipmentInputSchema, parseOrThrow } from "@/lib/validation";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("catalogues de traduction", () => {
  const reference = keys(fr).sort();
  it.each([
    ["en", en],
    ["es", es],
  ])("%s contient exactement les mêmes clés que fr", (_, messages) => {
    expect(keys(messages).sort()).toEqual(reference);
  });

  it("aucune traduction vide", () => {
    for (const messages of [fr, en, es]) {
      const flat = keys(messages).map((k) => k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], messages));
      expect(flat.every((v) => typeof v === "string" && v.length > 0)).toBe(true);
    }
  });
});

describe("choix de la langue", () => {
  it("négocie Accept-Language", () => {
    expect(negotiateLocale("es-ES,es;q=0.9,en;q=0.8")).toBe("es");
    expect(negotiateLocale("de-DE,en-US;q=0.7,fr;q=0.5")).toBe("en");
    expect(negotiateLocale("de-DE")).toBe("fr");
    expect(negotiateLocale(null)).toBe("fr");
    expect(negotiateLocale("fr;q=0.2,es;q=0.8")).toBe("es");
  });

  it("le cookie l'emporte sur l'en-tête", () => {
    const req = new Request("https://x", { headers: { cookie: "a=1; NEXT_LOCALE=en", "accept-language": "es" } });
    expect(localeFromRequest(req)).toBe("en");
    expect(localeFromRequest(new Request("https://x", { headers: { "accept-language": "es" } }))).toBe("es");
  });
});

describe("traduction des erreurs", () => {
  it("traduit erreurs métier et erreurs de champ", () => {
    expect(translateAppError(new NotFoundError(), "en").error).toBe("Resource not found");
    expect(translateAppError(new PlanLimitError(), "es")).toMatchObject({
      error: expect.stringContaining("15 equipos"),
      code: "PLAN_LIMIT_REACHED",
    });
    let err: ValidationError | undefined;
    try {
      parseOrThrow(equipmentInputSchema, { internalId: "x".repeat(101), nextCalibrationDate: "31/12/2026" });
    } catch (e) {
      err = e as ValidationError;
    }
    const en = translateAppError(err!, "en");
    expect(en.fieldErrors).toMatchObject({
      internalId: ["100 characters maximum"],
      name: ["Required field"],
      nextCalibrationDate: ["Invalid date (YYYY-MM-DD format)"],
    });
    expect(translateAppError(err!, "fr").fieldErrors?.name).toEqual(["Champ obligatoire"]);
  });
});

describe("contenus localisés", () => {
  it("formate les dates", () => {
    expect(formatDate("2027-03-20", "fr")).toBe("20/03/2027");
    expect(formatDate("2027-03-20", "en")).toBe("20/03/2027");
    expect(formatDate("2027-03-20", "es")).toBe("20/03/2027");
  });

  const items: AlertItem[] = [
    { equipmentId: "e1", internalId: "EQ-1", name: "Balance", location: null, nextCalibrationDate: "2026-09-20", level: "overdue", daysLeft: -6 },
    { equipmentId: "e2", internalId: "EQ-2", name: "Étuve", location: null, nextCalibrationDate: "2026-10-26", level: "j30", daysLeft: 30 },
  ];

  it("e-mail d'alerte en anglais", () => {
    const m = renderAlertEmail({ orgName: "ACME", appUrl: "https://a", items, locale: "en" });
    expect(m.subject).toBe("⚠️ 1 item overdue – 2 metrology alerts");
    expect(m.html).toContain('lang="en"');
    expect(m.text).toContain("overdue by 6 days");
    expect(m.text).toContain("[D-30]");
  });

  it("e-mail d'alerte en espagnol", () => {
    const m = renderAlertEmail({ orgName: "ACME", appUrl: "https://a", items, locale: "es" });
    expect(m.subject).toBe("⚠️ 1 equipo vencido – 2 alertas de metrología");
    expect(m.text).toContain("vencido hace 6 días");
    expect(m.html).toContain("Abrir la ficha");
  });
});
