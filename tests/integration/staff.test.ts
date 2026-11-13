import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { changeFacultyRequest, getFacultyRequest, listFacultyRequests } from "@/server/dal/staff";
import { answerMyRequest, getMyRequest } from "@/server/dal/requests";
import { listMyNotifications } from "@/server/dal/notifications";
import * as session from "@/server/session";
import { actAs, expect404 } from "./helpers";

vi.mock("@/server/session", () => ({ requireStudent: vi.fn(), requireStaff: vi.fn(), getCurrentRole: vi.fn() }));

let staff: session.StaffContext;
let foreignStaff: session.StaffContext;
let colleague: session.StaffContext;
let student: Awaited<ReturnType<typeof actAs>>;
let otherStudent: Awaited<ReturnType<typeof actAs>>;
const requestIds: string[] = [];
const testStaffIds: string[] = [];

beforeAll(async () => {
  const user = await prisma.user.findFirstOrThrow({ where: { username: "dekanat.fhb" }, include: { staff: true } });
  if (!user.staff) throw new Error("У демо-сотрудника нет StaffProfile");
  staff = { userId: user.id, staffId: user.staff.id, facultyCode: user.staff.facultyCode };
  const own = await prisma.studentProfile.findFirstOrThrow({ where: { group: { facultyCode: staff.facultyCode } }, include: { user: true } });
  const foreign = await prisma.studentProfile.findFirstOrThrow({ where: { group: { facultyCode: { not: staff.facultyCode } } }, include: { user: true, group: true } });
  student = await actAs(own.user.username!);
  otherStudent = await actAs(foreign.user.username!);
  // Отдельный сотрудник другого факультета без Account: проверяем реальную границу StaffProfile.
  const id = randomUUID();
  await prisma.user.create({ data: { id, name: "Тестовый сотрудник", email: `${id}@test.example`, role: "staff" } });
  testStaffIds.push(id);
  const profile = await prisma.staffProfile.create({ data: { userId: id, position: "Сотрудник деканата", facultyCode: foreign.group.facultyCode } });
  foreignStaff = { userId: id, staffId: profile.id, facultyCode: profile.facultyCode };
  const colleagueId = randomUUID();
  await prisma.user.create({ data: { id: colleagueId, name: "Второй тестовый сотрудник", email: `${colleagueId}@test.example`, role: "staff" } });
  testStaffIds.push(colleagueId);
  const colleagueProfile = await prisma.staffProfile.create({ data: { userId: colleagueId, position: "Сотрудник деканата", facultyCode: staff.facultyCode } });
  colleague = { userId: colleagueId, staffId: colleagueProfile.id, facultyCode: colleagueProfile.facultyCode };
});

beforeEach(() => {
  vi.mocked(session.requireStaff).mockResolvedValue(staff);
  vi.mocked(session.requireStudent).mockResolvedValue(student);
});

afterAll(async () => {
  // Удаляем только созданные этим файлом данные, не затрагиваем seed и другие тесты.
  await prisma.request.deleteMany({ where: { id: { in: requestIds } } });
  await prisma.user.deleteMany({ where: { id: { in: testStaffIds } } });
  await prisma.$disconnect();
});

async function makeRequest(status: "SUBMITTED" | "IN_PROGRESS" | "NEEDS_INFO" | "READY" = "SUBMITTED", owner = student) {
  const r = await prisma.request.create({ data: {
    studentId: owner.studentId, type: "study_certificate", status,
    payload: { destination: "По месту работы", format: "paper", copies: 1 },
    events: { create: { fromStatus: null, toStatus: status, actorType: "STUDENT", actorUserId: owner.userId } },
  } });
  requestIds.push(r.id);
  return r;
}

const change = (id: string, fromStatus: string, toStatus: string, comment = "") => changeFacultyRequest({ id, fromStatus, toStatus, comment });

describe("деканат: доступ и обработка", () => {
  it("список и карточка содержат только заявки факультета; фильтр работает", async () => {
    const own = await makeRequest();
    const foreign = await makeRequest("SUBMITTED", otherStudent);
    const list = await listFacultyRequests("SUBMITTED");
    expect(list.map((r) => r.id)).toContain(own.id);
    expect(list.map((r) => r.id)).not.toContain(foreign.id);
    expect((await listFacultyRequests("ALL")).map((r) => r.id)).not.toContain(foreign.id);
    expect(await getFacultyRequest(own.id)).toMatchObject({ id: own.id, student: { user: { name: expect.any(String) } } });
    await expect404(getFacultyRequest(foreign.id));
    await expect404(listFacultyRequests(["SUBMITTED", "ALL"]));
  });

  it("меняет статус, создаёт событие сотрудника и непрочитанное уведомление только студенту-владельцу", async () => {
    const r = await makeRequest();
    expect(await changeFacultyRequest({ id: r.id, fromStatus: "SUBMITTED", toStatus: "IN_PROGRESS", comment: "Проверяем документы", studentId: otherStudent.studentId, actorUserId: foreignStaff.userId })).toMatchObject({ ok: true });
    expect((await getMyRequest(r.id)).status).toBe("IN_PROGRESS");
    expect(await prisma.requestEvent.findMany({ where: { requestId: r.id, actorType: "STAFF" } })).toMatchObject([
      { fromStatus: "SUBMITTED", toStatus: "IN_PROGRESS", actorUserId: staff.userId, comment: "Проверяем документы" },
    ]);
    const notices = await prisma.notification.findMany({ where: { requestId: r.id }, include: { recipients: true } });
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ kind: "REQUEST_STATUS", recipients: [{ userId: student.userId, readAt: null }] });
    expect((await listMyNotifications()).map((n) => n.id)).toContain(notices[0].id);
    vi.mocked(session.requireStudent).mockResolvedValue(otherStudent);
    expect((await listMyNotifications()).map((n) => n.id)).not.toContain(notices[0].id);
  });

  it("чужой сотрудник получает 404 на чтение и изменение, БД не меняется", async () => {
    const r = await makeRequest();
    vi.mocked(session.requireStaff).mockResolvedValue(foreignStaff);
    expect((await listFacultyRequests("ALL")).map((v) => v.id)).not.toContain(r.id);
    await expect404(getFacultyRequest(r.id));
    await expect404(change(r.id, "SUBMITTED", "IN_PROGRESS"));
    expect(await prisma.request.findUniqueOrThrow({ where: { id: r.id } })).toMatchObject({ status: "SUBMITTED", updatedAt: r.updatedAt });
    expect(await prisma.requestEvent.count({ where: { requestId: r.id } })).toBe(1);
    expect(await prisma.notification.count({ where: { requestId: r.id } })).toBe(0);
  });

  it("недопустимый переход, неверный ожидаемый статус и уточнение без комментария ничего не меняют", async () => {
    const r = await makeRequest();
    expect(await change(r.id, "SUBMITTED", "READY")).toMatchObject({ ok: false });
    expect(await change(r.id, "IN_PROGRESS", "READY")).toMatchObject({ ok: false });
    expect(await change(r.id, "SUBMITTED", "REJECTED", " ")).toMatchObject({ ok: false });
    expect(await change(r.id, "SUBMITTED", "IN_PROGRESS")).toMatchObject({ ok: true });
    expect(await change(r.id, "IN_PROGRESS", "NEEDS_INFO", " ")).toMatchObject({ ok: false });
    expect(await change(r.id, "IN_PROGRESS", "NEEDS_INFO", "а".repeat(501))).toMatchObject({ ok: false });
    expect((await getFacultyRequest(r.id)).status).toBe("IN_PROGRESS");
    expect(await prisma.requestEvent.count({ where: { requestId: r.id, actorType: "STAFF" } })).toBe(1);
  });

  it("полный цикл: уточнение → ответ студента → работа → готова → исполнена", async () => {
    const r = await makeRequest();
    expect(await change(r.id, "SUBMITTED", "IN_PROGRESS")).toMatchObject({ ok: true });
    expect(await change(r.id, "IN_PROGRESS", "NEEDS_INFO", "Уточните получателя справки")).toMatchObject({ ok: true });
    expect(await change(r.id, "NEEDS_INFO", "IN_PROGRESS")).toMatchObject({ ok: false });
    expect(await answerMyRequest(r.id, "Предоставлю в отдел кадров")).toMatchObject({ ok: true });
    expect((await getFacultyRequest(r.id)).events.some((e) => e.actorType === "STUDENT" && e.comment === "Предоставлю в отдел кадров")).toBe(true);
    expect(await change(r.id, "SUBMITTED", "IN_PROGRESS")).toMatchObject({ ok: true });
    expect(await change(r.id, "IN_PROGRESS", "READY", "Бумажная справка готова, заберите в деканате")).toMatchObject({ ok: true });
    expect(await change(r.id, "READY", "DONE")).toMatchObject({ ok: true });
    expect((await getMyRequest(r.id)).status).toBe("DONE");
    expect(await change(r.id, "DONE", "IN_PROGRESS")).toMatchObject({ ok: false });
  });

  it("два одновременных перехода со старой карточки: один успех, одно событие и одно уведомление", async () => {
    const r = await makeRequest("IN_PROGRESS");
    vi.mocked(session.requireStaff).mockResolvedValueOnce(staff).mockResolvedValueOnce(colleague);
    const results = await Promise.all([
      change(r.id, "IN_PROGRESS", "READY"),
      change(r.id, "IN_PROGRESS", "REJECTED", "Документ не может быть выдан"),
    ]);
    expect(results.filter((v) => v.ok)).toHaveLength(1);
    expect(results.filter((v) => !v.ok)).toHaveLength(1);
    expect(await prisma.requestEvent.count({ where: { requestId: r.id, actorType: "STAFF" } })).toBe(1);
    expect(await prisma.notification.count({ where: { requestId: r.id } })).toBe(1);
  });

  it("отказ requireStaff останавливает чтение и запись", async () => {
    const r = await makeRequest();
    vi.mocked(session.requireStaff).mockImplementation(async () => notFound());
    await expect404(listFacultyRequests());
    await expect404(getFacultyRequest(r.id));
    await expect404(change(r.id, "SUBMITTED", "IN_PROGRESS"));
    expect((await prisma.request.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("SUBMITTED");
  });
});
