import { describe, expect, it } from "vitest";
import { addDays, addMonths, daysUntil, dueState, formatDateFr, isIsoDate } from "@/lib/dates";

describe("dates", () => {
  it("valide le format ISO", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("26-02-2026")).toBe(false);
  });

  it("ajoute des mois en gérant les fins de mois", () => {
    expect(addMonths("2026-01-15", 12)).toBe("2027-01-15");
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-11-30", 3)).toBe("2027-02-28");
    expect(addMonths("2026-06-10", 6)).toBe("2026-12-10");
  });

  it("calcule les écarts en jours", () => {
    expect(daysUntil("2026-10-26", "2026-09-26")).toBe(30);
    expect(daysUntil("2026-09-25", "2026-09-26")).toBe(-1);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("détermine l'état d'échéance", () => {
    expect(dueState("2026-09-25", "2026-09-26")).toBe("overdue");
    expect(dueState("2026-09-26", "2026-09-26")).toBe("due_soon");
    expect(dueState("2026-10-26", "2026-09-26")).toBe("due_soon");
    expect(dueState("2026-10-27", "2026-09-26")).toBe("ok");
  });

  it("formate en français", () => {
    expect(formatDateFr("2026-03-07")).toBe("07/03/2026");
    expect(formatDateFr(null)).toBe("—");
  });
});
