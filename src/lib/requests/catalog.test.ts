import { describe, expect, it } from "vitest";
import { addDays, mskDayKey } from "@/lib/format";
import { requestCatalog } from "./catalog";

describe("каталог заявок", () => {
  it("у каждого типа поля формы совпадают с ключами схемы", () => {
    for (const [type, spec] of Object.entries(requestCatalog)) {
      const shape = Object.keys((spec.schema as unknown as { shape?: object }).shape ?? (spec.schema as unknown as { def: { in?: { shape: object } } }).def.in?.shape ?? {});
      if (shape.length) expect(spec.fields.map((f) => f.name).sort(), type).toEqual(shape.sort());
    }
  });

  it("гостевой пропуск: с сегодняшнего дня и не дальше 30 дней", () => {
    const base = { guest: "Иванов Иван", building: "kronv", purpose: "Защита проекта" };
    const day = (n: number) => mskDayKey(addDays(new Date(), n));
    const ok = (date: string) => requestCatalog.guest_pass.schema.safeParse({ ...base, date }).success;
    expect(ok(day(0))).toBe(true);
    expect(ok(day(30))).toBe(true);
    expect(ok(day(-1))).toBe(false);
    expect(ok(day(31))).toBe(false);
  });

  it("справка-вызов: начало сессии не позже окончания", () => {
    const v = { employer: "ООО Ромашка", format: "electronic" };
    expect(requestCatalog.employer_call.schema.safeParse({ ...v, dateFrom: "2027-01-10", dateTo: "2027-01-31" }).success).toBe(true);
    expect(requestCatalog.employer_call.schema.safeParse({ ...v, dateFrom: "2027-02-01", dateTo: "2027-01-31" }).success).toBe(false);
  });

  it("IT-поддержка: место необязательно, тема — только из списка", () => {
    const s = requestCatalog.it_support.schema;
    expect(s.safeParse({ topic: "wifi", details: "Не подключается к сети в коворкинге" }).success).toBe(true);
    expect(s.safeParse({ topic: "printer-hack", details: "Не подключается к сети в коворкинге" }).success).toBe(false);
  });
});
