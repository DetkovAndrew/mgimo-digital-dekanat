// Сервисы (docs/plans/services.md, ревью Codex 47): печать по коду и Wi-Fi — доступ A/B, квоты, гонки, сроки.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PRINTERS } from "@/lib/campus/printers";
import { prisma } from "@/server/db";
import { cancelMyPrintJob, createMyPrintJob, getMyPrint, releaseMyPrintJob } from "@/server/dal/print";
import { getMyWifi, guestCode, rotateMyWifiPassword } from "@/server/dal/wifi";
import { actAs, expect404, makeStudent } from "./helpers";

vi.mock("@/server/session", () => ({ requireStudent: vi.fn(), requireStaff: vi.fn(), getCurrentRole: vi.fn(), studentForApi: vi.fn() }));

type Who = Awaited<ReturnType<typeof actAs>>;
let A: Who;
let B: Who;
const tag = Date.now().toString(36);
const as = (who: Who) => actAs(`svc-${who === A ? "a" : "b"}-${tag}`);
const job = (o: Partial<{ fileName: string; pages: number; copies: number; color: boolean; duplex: boolean }> = {}) => ({
  fileName: "Курсовая.pdf",
  pages: 5,
  copies: 1,
  color: false,
  duplex: true,
  ...o,
});
const okPrinter = PRINTERS.find((p) => p.status !== "paper" && p.color)!;
const paperPrinter = PRINTERS.find((p) => p.status === "paper")!;
const bwPrinter = PRINTERS.find((p) => p.status !== "paper" && !p.color)!;
const reset = (who: Who) => prisma.printJob.deleteMany({ where: { studentId: who.studentId } });

beforeAll(async () => {
  A = await makeStudent(`svc-a-${tag}`);
  B = await makeStudent(`svc-b-${tag}`);
});
afterAll(async () => {
  const ids = [A.studentId, B.studentId];
  await prisma.printJob.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.wifiCredential.deleteMany({ where: { studentId: { in: ids } } });
  await prisma.$disconnect();
});

describe("печать: доступ", () => {
  it("задание видно и управляется только владельцем; чужое — 404 без изменений", async () => {
    await as(A);
    await reset(A);
    expect(await createMyPrintJob(job())).toMatchObject({ ok: true });
    const mine = (await getMyPrint()).queued;
    expect(mine).toHaveLength(1);
    expect(mine[0].code).toMatch(/^\d{6}$/);

    await as(B);
    expect((await getMyPrint()).queued).toHaveLength(0);
    await expect404(cancelMyPrintJob(mine[0].id));
    await expect404(releaseMyPrintJob(mine[0].id, okPrinter.id));
    expect(await prisma.printJob.findUniqueOrThrow({ where: { id: mine[0].id } })).toMatchObject({ status: "QUEUED", studentId: A.studentId });
  });

  it("владелец, стоимость, код и статус задаёт сервер, а не запрос", async () => {
    await as(B);
    await reset(B);
    const forged = { ...job({ pages: 3, copies: 2, color: true }), studentId: A.studentId, cost: 1, code: "000000", status: "PRINTED" };
    expect(await createMyPrintJob(forged)).toMatchObject({ ok: true });
    const created = await prisma.printJob.findFirstOrThrow({ where: { studentId: B.studentId } });
    expect(created).toMatchObject({ studentId: B.studentId, cost: 24, status: "QUEUED" });
    expect(await prisma.printJob.count({ where: { studentId: A.studentId, cost: 1 } })).toBe(0);
  });
});

describe("печать: квота и очередь", () => {
  it("действующее задание видно и за длинной историей", async () => {
    await as(A);
    await reset(A);
    expect(await createMyPrintJob(job({ pages: 1 }))).toMatchObject({ ok: true });
    await prisma.printJob.createMany({
      data: Array.from({ length: 25 }, (_, i) => ({
        studentId: A.studentId, fileName: `old-${i}.pdf`, pages: 1, copies: 1, color: false, duplex: false, cost: 1,
        code: String(100000 + i), status: "CANCELLED" as const, expiresAt: new Date(Date.now() + 3_600_000),
      })),
    });
    const view = await getMyPrint();
    expect(view.queued).toHaveLength(1);
    expect(view.history).toHaveLength(10);
  });

  it("не больше 100 страниц в месяц; отмена возвращает страницы", async () => {
    await as(A);
    await reset(A);
    expect(await createMyPrintJob(job({ pages: 30, color: true }))).toMatchObject({ ok: false }); // 120 > 100
    expect(await createMyPrintJob(job({ pages: 60 }))).toMatchObject({ ok: true });
    expect(await createMyPrintJob(job({ pages: 50 }))).toMatchObject({ ok: false });
    const first = (await getMyPrint()).queued[0];
    expect(await cancelMyPrintJob(first.id)).toMatchObject({ ok: true });
    expect((await getMyPrint()).left).toBe(100);
    expect(await createMyPrintJob(job({ pages: 50 }))).toMatchObject({ ok: true });
  });

  it("не больше трёх заданий в очереди", async () => {
    await as(A);
    await reset(A);
    for (let i = 0; i < 3; i++) expect(await createMyPrintJob(job({ pages: 1 }))).toMatchObject({ ok: true });
    expect(await createMyPrintJob(job({ pages: 1 }))).toMatchObject({ ok: false });
  });

  it("параллельные задания не превышают квоту", async () => {
    await as(A);
    await reset(A);
    const results = await Promise.all([createMyPrintJob(job({ pages: 60 })), createMyPrintJob(job({ pages: 60 })), createMyPrintJob(job({ pages: 60 }))]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await getMyPrint()).used).toBe(60);
  });

  it("задание прошлого месяца не тратит бюджет этого", async () => {
    await as(A);
    await reset(A);
    expect(await createMyPrintJob(job({ pages: 90 }))).toMatchObject({ ok: true });
    const j = await prisma.printJob.findFirstOrThrow({ where: { studentId: A.studentId } });
    await prisma.printJob.update({ where: { id: j.id }, data: { status: "PRINTED", printerId: okPrinter.id, printedAt: new Date(), createdAt: new Date(Date.now() - 40 * 86_400_000) } });
    expect((await getMyPrint()).left).toBe(100);
  });
});

describe("печать: выпуск у принтера", () => {
  it("исправный принтер печатает один раз; без бумаги и цвет на ч/б — отказ", async () => {
    await as(A);
    await reset(A);
    expect(await createMyPrintJob(job({ color: true }))).toMatchObject({ ok: true });
    const id = (await getMyPrint()).queued[0].id;
    expect(await releaseMyPrintJob(id, paperPrinter.id)).toMatchObject({ ok: false });
    expect(await releaseMyPrintJob(id, bwPrinter.id)).toMatchObject({ ok: false });
    expect(await releaseMyPrintJob(id, "printer-of-the-dean")).toMatchObject({ ok: false });
    expect(await releaseMyPrintJob(id, okPrinter.id)).toMatchObject({ ok: true });
    expect(await releaseMyPrintJob(id, okPrinter.id)).toMatchObject({ ok: false });
    const view = await getMyPrint();
    expect(view.used).toBe(20);
    expect(view.history[0]).toMatchObject({ id, status: "PRINTED", printerId: okPrinter.id });
    expect(view.history[0]).not.toHaveProperty("code"); // код напечатанного задания не уходит в браузер
  });

  it("истёкшее задание не печатается и не тратит страницы", async () => {
    await as(A);
    await reset(A);
    const yesterday = () => new Date(Date.now() - 25 * 3_600_000);
    expect(await createMyPrintJob(job({ pages: 40 }), yesterday)).toMatchObject({ ok: true });
    const view = await getMyPrint();
    expect(view.queued).toHaveLength(0);
    expect(view.history[0]).toMatchObject({ expired: true });
    expect(await releaseMyPrintJob(view.history[0].id, okPrinter.id)).toMatchObject({ ok: false });
  });

  it("выпуск и отмена одного задания одновременно: проходит одно", async () => {
    await as(A);
    await reset(A);
    expect(await createMyPrintJob(job())).toMatchObject({ ok: true });
    const id = (await getMyPrint()).queued[0].id;
    const [r1, r2] = await Promise.all([releaseMyPrintJob(id, okPrinter.id), cancelMyPrintJob(id)]);
    expect([r1.ok, r2.ok].filter(Boolean)).toHaveLength(1);
  });
});

describe("Wi-Fi", () => {
  it("смена пароля меняет только свой и не чаще раза в 10 минут", async () => {
    await as(B);
    const b1 = (await getMyWifi()).password;
    await as(A);
    const a1 = await getMyWifi();
    expect(a1.password).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(a1.login).toBe(`svc-a-${tag}`);
    expect(await rotateMyWifiPassword()).toMatchObject({ ok: true });
    const a2 = (await getMyWifi()).password;
    expect(a2).not.toBe(a1.password);
    expect(await rotateMyWifiPassword()).toMatchObject({ ok: false });
    expect((await getMyWifi()).password).toBe(a2);
    await as(B);
    expect((await getMyWifi()).password).toBe(b1);
  });

  it("две одновременные смены: проходит одна", async () => {
    await as(B);
    await prisma.wifiCredential.deleteMany({ where: { studentId: B.studentId } });
    const results = await Promise.all([rotateMyWifiPassword(), rotateMyWifiPassword()]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await prisma.wifiCredential.findUniqueOrThrow({ where: { studentId: B.studentId } })).toMatchObject({ version: 2 });
  });

  it("гостевой код общий для всех и меняется по дням", async () => {
    await as(A);
    const a = (await getMyWifi()).guest;
    await as(B);
    expect((await getMyWifi()).guest.code).toBe(a.code);
    expect(a.qr).toBe(`WIFI:T:WPA;S:University Guest;P:${a.code};;`);
    const s = process.env.BETTER_AUTH_SECRET ?? "";
    expect(guestCode(s, "2026-11-14")).not.toBe(guestCode(s, "2026-11-15"));
  });
});
