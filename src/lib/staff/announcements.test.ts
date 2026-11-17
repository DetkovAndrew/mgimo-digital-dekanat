import { describe, expect, it } from "vitest";
import { announcementSchema } from "./announcements";

const base = { audience: "faculty", course: "", group: "", title: "Перенос консультаций", body: "Консультации переносятся на следующую неделю.", important: false };
const ok = (v: object) => announcementSchema.safeParse(v).success;

describe("объявление деканата: проверка ввода", () => {
  it("всему факультету — без курса и группы", () => expect(ok(base)).toBe(true));
  it("курсу — только 1–6; группе — нужен код", () => {
    expect(ok({ ...base, audience: "course", course: "3" })).toBe(true);
    expect(ok({ ...base, audience: "course", course: "" })).toBe(false);
    expect(ok({ ...base, audience: "course", course: "9" })).toBe(false);
    expect(ok({ ...base, audience: "group", group: "H3301" })).toBe(true);
    expect(ok({ ...base, audience: "group", group: "" })).toBe(false);
  });
  it("длина заголовка и текста; неизвестная аудитория — отказ", () => {
    expect(ok({ ...base, title: "ab" })).toBe(false);
    expect(ok({ ...base, body: "x".repeat(1001) })).toBe(false);
    expect(ok({ ...base, audience: "university" })).toBe(false);
  });
});
