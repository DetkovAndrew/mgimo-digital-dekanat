import { describe, expect, it } from "vitest";
import { allPlanRooms } from "@/lib/campus/plans";
import { PRINTERS, printerProblem } from "@/lib/campus/printers";
import { cleanFileName, countPdfPages, mskMonthStart, PrintJobInput, printCost } from "./print";

const pdf = (body: string) => new TextEncoder().encode(`%PDF-1.4\n${body}\n%%EOF`);

describe("печать", () => {
  it("считает страницы по корню дерева страниц", () => {
    const doc = pdf("1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj 2 0 obj << /Kids [3 0 R 9 0 R] /Count 12 /Type /Pages >> endobj 9 0 obj << /Type /Pages /Parent 2 0 R /Count 7 >> endobj");
    expect(countPdfPages(doc)).toBe(12);
  });

  it("без /Count считает объекты страниц, мусор — null", () => {
    expect(countPdfPages(pdf("<< /Type /Page >> << /Type /Page /Parent 2 0 R >> << /Type /Pages >>"))).toBe(2);
    expect(countPdfPages(new TextEncoder().encode("не PDF"))).toBeNull();
    expect(countPdfPages(pdf("ничего"))).toBeNull();
  });

  it("враждебный PDF не подвешивает браузер (ревью Codex 48)", () => {
    const evil = pdf("/Type /Pages ".repeat(200_000)); // ~2,6 МБ: тысячи словарей без «<<»
    const t = performance.now();
    countPdfPages(evil);
    expect(performance.now() - t).toBeLessThan(1500);
    // Запасная ветка (без /Count): больше 10 000 страниц — не считаем, просим ввести.
    expect(countPdfPages(pdf("<< /Type /Page >> ".repeat(20_000)))).toBeNull();
    expect(countPdfPages(pdf("<< /Type /Page >> ".repeat(300)))).toBe(300);
  });

  it("стоимость: копии и цвет", () => {
    expect(printCost(10, 2, false)).toBe(20);
    expect(printCost(3, 1, true)).toBe(12);
  });

  it("месяц по Москве: 1 декабря 01:00 МСК — уже декабрь, 30 ноября 23:00 — ноябрь", () => {
    expect(mskMonthStart(new Date("2026-11-30T22:30:00Z")).toISOString()).toBe("2026-11-30T21:00:00.000Z");
    expect(mskMonthStart(new Date("2026-11-30T20:00:00Z")).toISOString()).toBe("2026-10-31T21:00:00.000Z");
    expect(mskMonthStart(new Date("2027-01-01T00:30:00+03:00")).toISOString()).toBe("2026-12-31T21:00:00.000Z");
  });

  it("имя файла: без пути и управляющих символов, до 120", () => {
    expect(cleanFileName("C:\\Users\\a\\Курсовая.pdf")).toBe("Курсовая.pdf");
    expect(cleanFileName("a\u0000b\nc.pdf")).toBe("abc.pdf");
    expect(cleanFileName("x".repeat(300))).toHaveLength(120);
    expect(PrintJobInput.safeParse({ fileName: "\u0000", pages: 1, copies: 1, color: false, duplex: false }).success).toBe(false);
    expect(PrintJobInput.safeParse({ fileName: "a.pdf", pages: 201, copies: 1, color: false, duplex: false }).success).toBe(false);
  });

  it("принтеры стоят в комнатах со схем; цвет и бумага", () => {
    const rooms = new Set(allPlanRooms().map((r) => `${r.buildingId}/${r.number}`));
    for (const p of PRINTERS) expect(rooms.has(`${p.buildingId}/${p.room}`), p.id).toBe(true);
    const bw = PRINTERS.find((p) => !p.color && p.status !== "paper")!;
    expect(printerProblem(bw, { color: true })).toMatch(/чёрно-белым/);
    expect(printerProblem(PRINTERS.find((p) => p.status === "paper")!, { color: false })).toMatch(/бумаги/);
  });
});
