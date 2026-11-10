// Разделение данных студентов: студент A не может прочитать или изменить данные студента B,
// даже подставив чужой id (требование ТЗ и AGENTS.md).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/server/db";
import { getMyGrades } from "@/server/dal/grades";
import { listMyNotifications, markMyNotificationRead } from "@/server/dal/notifications";
import { answerMyRequest, cancelMyRequest, createMyRequest, getMyRequest, listMyRequests } from "@/server/dal/requests";
import { getMySchedule } from "@/server/dal/schedule";
import { actAs, expect404 } from "./helpers";

vi.mock("@/server/session", () => ({ requireStudent: vi.fn(), requireStaff: vi.fn(), getCurrentRole: vi.fn() }));

let A: Awaited<ReturnType<typeof actAs>>;
let B: Awaited<ReturnType<typeof actAs>>;
let bRequestId: string;
let bNeedsInfoId: string;

beforeAll(async () => {
  A = await actAs("alina.lebedeva");
  B = await actAs("timur.orlov");
  const bRequests = await prisma.request.findMany({ where: { studentId: B.studentId } });
  bRequestId = bRequests[0].id;
  bNeedsInfoId = bRequests.find((r) => r.status === "NEEDS_INFO")!.id;
});

afterAll(() => prisma.$disconnect());

describe("заявки", () => {
  it("A не видит заявки B в своём списке", async () => {
    await actAs("alina.lebedeva");
    const list = await listMyRequests();
    expect(list.length).toBeGreaterThan(0);
    expect(list.map((r) => r.id)).not.toContain(bRequestId);
  });

  it("A получает 404 на заявку B по прямому id", async () => {
    await actAs("alina.lebedeva");
    await expect404(getMyRequest(bRequestId));
  });

  it("A не может отозвать заявку B — 404, заявка не меняется", async () => {
    await actAs("alina.lebedeva");
    const before = await prisma.request.findUniqueOrThrow({ where: { id: bRequestId } });
    await expect404(cancelMyRequest(bRequestId));
    const after = await prisma.request.findUniqueOrThrow({ where: { id: bRequestId } });
    expect(after.status).toBe(before.status);
  });

  it("A не может ответить на уточнение по заявке B", async () => {
    await actAs("alina.lebedeva");
    await expect404(answerMyRequest(bNeedsInfoId, "Чужой ответ"));
    expect((await prisma.request.findUniqueOrThrow({ where: { id: bNeedsInfoId } })).status).toBe("NEEDS_INFO");
  });

  it("новая заявка всегда принадлежит текущему студенту, лишние поля отбрасываются", async () => {
    await actAs("alina.lebedeva");
    const r = await createMyRequest("dean_question", {
      subject: "Тест владельца",
      message: "Проверяем, что владелец берётся из сессии",
      studentId: B.studentId, // попытка подставить чужого владельца
      status: "DONE",
    });
    expect(r.ok).toBe(true);
    const created = await prisma.request.findUniqueOrThrow({ where: { id: (r as { id: string }).id } });
    expect(created.studentId).toBe(A.studentId);
    expect(created.status).toBe("SUBMITTED");
    expect(created.payload).toEqual({ subject: "Тест владельца", message: "Проверяем, что владелец берётся из сессии" });
  });

  it("невалидная заявка не создаётся", async () => {
    await actAs("alina.lebedeva");
    const r = await createMyRequest("study_certificate", { destination: "", format: "fax", copies: 99 });
    expect(r.ok).toBe(false);
  });
});

describe("уведомления, расписание, оценки", () => {
  it("A не может отметить прочитанным уведомление B", async () => {
    const bUnread = await prisma.notificationRecipient.findFirstOrThrow({ where: { userId: B.userId, readAt: null } });
    await actAs("alina.lebedeva");
    await markMyNotificationRead(bUnread.notificationId);
    const after = await prisma.notificationRecipient.findUniqueOrThrow({
      where: { notificationId_userId: { notificationId: bUnread.notificationId, userId: B.userId } },
    });
    expect(after.readAt).toBeNull();
  });

  it("в уведомлениях A нет адресованных только B", async () => {
    await actAs("alina.lebedeva");
    const mine = new Set((await listMyNotifications()).map((n) => n.id));
    const onlyB = await prisma.notification.findMany({
      where: { recipients: { some: { userId: B.userId }, none: { userId: A.userId } } },
      select: { id: true },
    });
    expect(onlyB.length).toBeGreaterThan(0);
    for (const n of onlyB) expect(mine.has(n.id)).toBe(false);
  });

  it("расписание A — только занятия группы A", async () => {
    await actAs("alina.lebedeva");
    const items = await getMySchedule({ from: new Date("2026-09-01"), to: new Date("2027-01-01") });
    const lessonIds = items.filter((i) => i.source === "lesson").map((i) => i.id);
    const foreign = await prisma.lesson.count({ where: { id: { in: lessonIds }, offering: { groupId: { not: A.groupId } } } });
    expect(lessonIds.length).toBeGreaterThan(0);
    expect(foreign).toBe(0);
  });

  it("в успеваемости A только результаты A", async () => {
    await actAs("alina.lebedeva");
    const terms = await getMyGrades();
    const resultCount = terms.flatMap((t) => t.offerings.flatMap((o) => o.assessments.flatMap((a) => a.results))).length;
    const own = await prisma.gradeResult.count({ where: { studentId: A.studentId } });
    expect(resultCount).toBe(own);
  });
});
