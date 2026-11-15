import { describe, expect, it } from "vitest";
import { requestCatalog } from "./catalog";
import { requestGuide } from "./guide";

const norm = (s: string) => s.toLowerCase().replaceAll("ё", "е");
/** Тот же поиск, что в каталоге «Новая заявка» (request-picker.tsx). */
const search = (q: string) =>
  Object.entries(requestCatalog)
    .filter(([key, s]) => norm(`${s.title} ${s.description} ${requestGuide[key as keyof typeof requestGuide].aka.join(" ")}`).includes(norm(q)))
    .map(([key]) => key);

describe("подсказки к каталогу заявок", () => {
  it("у каждой заявки есть бытовые названия и что подготовить", () => {
    expect(Object.keys(requestGuide).sort()).toEqual(Object.keys(requestCatalog).sort());
    for (const [type, g] of Object.entries(requestGuide)) {
      expect(g.aka.length, type).toBeGreaterThan(0);
      expect(g.prepare.length, type).toBeGreaterThan(0);
    }
  });

  it("поиск находит заявку по словам студента, а не только по названию", () => {
    expect(search("академ")).toContain("academic_leave");
    expect(search("повышенка")).toContain("achievement_scholarship");
    expect(search("форма 26")).toContain("military_certificate");
    expect(search("вернуть 13%")).toContain("tax_deduction");
    expect(search("потерял студенческий")).toContain("document_duplicate");
    expect(search("свободное посещение")).toContain("individual_schedule");
  });
});
