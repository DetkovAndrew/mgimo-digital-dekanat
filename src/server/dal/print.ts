import "server-only";
import { randomInt } from "node:crypto";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { printerById, printerProblem } from "@/lib/campus/printers";
import { mskMonthStart, PRINT_RULES, PrintJobInput, printCost } from "@/lib/services/print";
import { prisma } from "../db";
import { requireStudent } from "../session";

// Печать по коду (docs/plans/services.md). Владельца определяет сессия; стоимость, код, статус и срок — сервер.
// Создание, выпуск и отмена берут одну блокировку строки студента: остаток не уйдёт в минус ни при какой гонке.

type Tx = Prisma.TransactionClient;
export type PrintResult = { ok: true; message: string } | { ok: false; error: string };

const lockStudent = (tx: Tx, studentId: string) => tx.$queryRaw`SELECT "id" FROM "student_profile" WHERE "id" = ${studentId} FOR UPDATE`;

/** Израсходовано за месяц: напечатанные и ещё действующие задания, созданные в этом месяце (МСК). */
async function usedThisMonth(db: Tx | typeof prisma, studentId: string, at: Date) {
  const r = await db.printJob.aggregate({
    _sum: { cost: true },
    where: {
      studentId,
      createdAt: { gte: mskMonthStart(at) },
      OR: [{ status: "PRINTED" }, { status: "QUEUED", expiresAt: { gt: at } }],
    },
  });
  return r._sum.cost ?? 0;
}

const jobSelect = {
  id: true, fileName: true, pages: true, copies: true, color: true, duplex: true, cost: true, status: true, printerId: true, createdAt: true, expiresAt: true, printedAt: true,
} satisfies Prisma.PrintJobSelect;

export async function getMyPrint(now = new Date()) {
  const { studentId } = await requireStudent();
  // Очередь и история — отдельными запросами: действующее задание не должно пропасть за длинной историей (ревью Codex 48).
  const [used, queued, history] = await Promise.all([
    usedThisMonth(prisma, studentId, now),
    prisma.printJob.findMany({
      where: { studentId, status: "QUEUED", expiresAt: { gt: now } },
      orderBy: { createdAt: "asc" },
      select: { ...jobSelect, code: true },
    }),
    prisma.printJob.findMany({
      where: { studentId, OR: [{ status: { not: "QUEUED" } }, { expiresAt: { lte: now } }] },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: jobSelect,
    }),
  ]);
  return {
    limit: PRINT_RULES.monthlyPages,
    used,
    left: Math.max(0, PRINT_RULES.monthlyPages - used),
    queued,
    // Истёкшее задание — в истории как «срок истёк»; код истории не выбирается вовсе.
    history: history.map((j) => ({ ...j, expired: j.status === "QUEUED" })),
  };
}

/** Остаток страниц для сводок (хаб сервисов, помощник): без имён файлов и кодов. */
export async function getMyPrintBalance(now = new Date()) {
  const { studentId } = await requireStudent();
  const [used, queued] = await Promise.all([
    usedThisMonth(prisma, studentId, now),
    prisma.printJob.count({ where: { studentId, status: "QUEUED", expiresAt: { gt: now } } }),
  ]);
  return { limit: PRINT_RULES.monthlyPages, left: Math.max(0, PRINT_RULES.monthlyPages - used), queued };
}

const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === "P2002";

export async function createMyPrintJob(input: unknown, clock: () => Date = () => new Date()): Promise<PrintResult> {
  const { studentId } = await requireStudent();
  const parsed = PrintJobInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Проверьте задание" };
  const { fileName, pages, copies, color, duplex } = parsed.data;
  const cost = printCost(pages, copies, color);

  // Совпадение кода с чужим заданием в очереди (уникальный индекс) — повтор всей транзакции с новым кодом.
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        await lockStudent(tx, studentId);
        const at = clock(); // после блокировки: параллельный выпуск или отмена уже записаны
        const queued = await tx.printJob.count({ where: { studentId, status: "QUEUED", expiresAt: { gt: at } } });
        if (queued >= PRINT_RULES.maxQueued) return { ok: false, error: `В очереди уже ${PRINT_RULES.maxQueued} задания. Напечатайте или отмените одно.` };
        const left = PRINT_RULES.monthlyPages - (await usedThisMonth(tx, studentId, at));
        if (cost > left) return { ok: false, error: `Не хватает страниц: нужно ${cost}, осталось ${Math.max(0, left)}.` };
        const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
        await tx.printJob.create({
          data: { studentId, fileName, pages, copies, color, duplex, cost, code, expiresAt: new Date(at.getTime() + PRINT_RULES.ttlHours * 3_600_000) },
        });
        return { ok: true, message: `Задание в очереди: списано ${cost} стр. Код действует ${PRINT_RULES.ttlHours} часа.` } as const;
      });
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 4) continue;
      throw e;
    }
  }
}

/** Своё задание под блокировкой студента; чужое или несуществующее — 404. */
async function lockedJob(tx: Tx, studentId: string, id: unknown) {
  if (typeof id !== "string" || !id || id.length > 64) notFound();
  await lockStudent(tx, studentId);
  const job = await tx.printJob.findFirst({ where: { id, studentId }, select: { id: true, status: true, expiresAt: true, color: true } });
  if (!job) notFound();
  return job;
}

export async function cancelMyPrintJob(id: unknown): Promise<PrintResult> {
  const { studentId } = await requireStudent();
  return prisma.$transaction(async (tx) => {
    const job = await lockedJob(tx, studentId, id);
    if (job.status !== "QUEUED") return { ok: false, error: "Задание уже напечатано или отменено." };
    await tx.printJob.updateMany({ where: { id: job.id, studentId, status: "QUEUED" }, data: { status: "CANCELLED" } });
    return { ok: true, message: "Задание отменено, страницы вернулись." };
  });
}

/** Демо-выпуск: в жизни студент вводит код у принтера. Здесь — кнопка «Напечатать» у выбранного принтера. */
export async function releaseMyPrintJob(id: unknown, printerId: unknown, clock: () => Date = () => new Date()): Promise<PrintResult> {
  const { studentId } = await requireStudent();
  const printer = typeof printerId === "string" ? printerById(printerId) : undefined;
  if (!printer) return { ok: false, error: "Выберите принтер из списка." };
  return prisma.$transaction(async (tx) => {
    const job = await lockedJob(tx, studentId, id);
    const at = clock();
    if (job.status !== "QUEUED") return { ok: false, error: "Задание уже напечатано или отменено." };
    if (job.expiresAt <= at) return { ok: false, error: "Срок задания истёк. Отправьте его ещё раз." };
    const problem = printerProblem(printer, job);
    if (problem) return { ok: false, error: `${problem}. Выберите другой принтер.` };
    const r = await tx.printJob.updateMany({
      where: { id: job.id, studentId, status: "QUEUED", expiresAt: { gt: at } },
      data: { status: "PRINTED", printerId: printer.id, printedAt: at },
    });
    if (r.count !== 1) return { ok: false, error: "Задание уже изменилось. Обновите страницу." };
    return { ok: true, message: `Напечатано: ${printer.title}. Заберите листы.` };
  });
}
