import { describe, expect, it } from "vitest";
import { buildCalendar, foldLine, icsDate, icsText } from "./ics";
import { buildVCard } from "./vcard";

const enc = new TextEncoder();
const event = { uid: "lesson-1@university", start: new Date("2026-11-19T12:20:00Z"), end: new Date("2026-11-19T13:50:00Z"), summary: "Философия · семинар" };

describe("iCalendar", () => {
  it("экранирует «\\ ; ,» и переводы строк, убирает управляющие символы — CRLF-инъекция не создаёт свойство", () => {
    expect(icsText("a\\b;c,d\ne")).toBe("a\\\\b\\;c\\,d\\ne");
    const evil = icsText("Причина\r\nATTENDEE:mailto:x@y\u0007");
    expect(evil).toBe("Причина\\nATTENDEE:mailto:x@y");
    const cal = buildCalendar([{ ...event, description: "Причина\r\nATTENDEE:mailto:x@y" }], { name: "Тест" });
    expect(cal.split("\r\n").some((l) => l.startsWith("ATTENDEE"))).toBe(false);
  });

  it("переносит строки по 75 октетов, не разрывая кириллицу; продолжение — с пробела", () => {
    const line = `SUMMARY:${"Ж".repeat(80)}`;
    const parts = foldLine(line).split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(enc.encode(p).length).toBeLessThanOrEqual(75);
    expect(parts.slice(1).every((p) => p.startsWith(" "))).toBe(true);
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join("")).toBe(line);
    expect(foldLine("SHORT")).toBe("SHORT");
  });

  it("календарь: обязательные свойства, UTC, CRLF; отменённая пара — CANCELLED и без напоминания", () => {
    expect(icsDate(new Date("2026-11-19T12:20:00.000Z"))).toBe("20261119T122000Z");
    const cal = buildCalendar([event, { ...event, uid: "lesson-2@university", cancelled: true, alarmMinutes: 60 }], { name: "Расписание", now: new Date("2026-11-18T10:00:00Z"), feed: true });
    expect(cal.endsWith("\r\n")).toBe(true);
    expect(cal.replace(/\r\n/g, "")).not.toMatch(/\n/);
    const lines = cal.split("\r\n");
    for (const p of ["BEGIN:VCALENDAR", "VERSION:2.0", "METHOD:PUBLISH", "DTSTAMP:20261118T100000Z", "DTSTART:20261119T122000Z", "STATUS:CANCELLED", "TRANSP:TRANSPARENT", "REFRESH-INTERVAL;VALUE=DURATION:PT1H"])
      expect(lines).toContain(p);
    expect(lines.filter((l) => l.startsWith("PRODID:"))).toHaveLength(1);
    expect(cal).not.toContain("BEGIN:VALARM");
    expect(buildCalendar([{ ...event, alarmMinutes: 1440 }], { name: "x" })).toContain("TRIGGER:-PT1440M");
  });
});

describe("vCard", () => {
  it("контакт службы: версия 3.0, почта, адрес; текст экранирован, без инъекций строк", () => {
    const card = buildVCard({ org: "University", name: "Деканат", email: "dekanat@university.example", address: "Кронверкский, 49, ауд. 1117", note: "по будням с 10 до 17\r\nEMAIL:evil@x" });
    const lines = card.replace(/\r\n /g, "").split("\r\n"); // склеить перенесённые строки
    expect(lines[0]).toBe("BEGIN:VCARD");
    expect(lines).toContain("VERSION:3.0");
    expect(lines).toContain("EMAIL;TYPE=INTERNET,WORK:dekanat@university.example");
    expect(lines).toContain("ADR;TYPE=WORK:;;Кронверкский\\, 49\\, ауд. 1117;Санкт-Петербург;;;Россия");
    expect(lines.filter((l) => l.startsWith("EMAIL"))).toHaveLength(1);
  });
});
