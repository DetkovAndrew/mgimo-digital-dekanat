// Перенос и отмена пары сотрудником: только свой факультет, без накладок, одна транзакция с историей и уведомлением.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { lessonVersion } from "@/lib/staff/schedule";
import { addDays, mskDayKey } from "@/lib/format";
import { prisma } from "@/server/db";
import { getMySchedule } from "@/server/dal/schedule";
import { getFacultyLesson, listFacultyLessons, rescheduleFacultyLesson } from "@/server/dal/staff-schedule";
import * as session from "@/server/session";
import { undoStaffChanges } from "../../scripts/undo-staff";
import { actAs, expect404 } from "./helpers";

vi.mock("@/server/session", () => ({ requireStudent: vi.fn(), requireStaff: vi.fn(), getCurrentRole: vi.fn() }));

let staff: session.StaffContext;
let foreignStaff: session.StaffContext;
let student: Awaited<ReturnType<typeof actAs>>;
let offeringId: string;
let room: { id: string; number: string; buildingId: string };
let room2: { id: string; number: string };
const lessonIds: string[] = [];
const userIds: string[] = [];

// У каждого теста свой день в будущем, время — вечер после последней пары демо-данных (до 20:10): тесты не сталкиваются
// ни с seed, ни друг с другом. Время — по Москве.
let offset = 4;
const nextDay = () => mskDayKey(addDays(new Date(), ++offset));
const at = (t: string, d: string) => new Date(`${d}T${t}:00+03:00`);

async function makeLesson(start: string, end: string, d: string) {
  const l = await prisma.lesson.create({
    data: { offeringId, kind: "PRACTICE", startsAt: at(start, d), endsAt: at(end, d), buildingId: room.buildingId, room: "ауд. 9999", status: "SCHEDULED" },
  });
  lessonIds.push(l.id);
  return l;
}
const versionOf = async (id: string) => (await getFacultyLesson(id)).version;
const move = (id: string, expected: string, d: string, over: Record<string, string> = {}) =>
  rescheduleFacultyLesson({ action: "move", id, expected, reason: "Аудитория на ремонте", date: d, start: "20:15", end: "21:30", building: "", room: "", ...over });

beforeAll(async () => {
  const user = await prisma.user.findFirstOrThrow({ where: { username: "dekanat.fhb" }, include: { staff: true } });
  staff = { userId: user.id, staffId: user.staff!.id, facultyCode: user.staff!.facultyCode };
  const own = await prisma.studentProfile.findFirstOrThrow({ where: { group: { facultyCode: staff.facultyCode } }, include: { user: true } });
  student = await actAs(own.user.username!);
  offeringId = (await prisma.courseOffering.findFirstOrThrow({ where: { groupId: own.groupId }, orderBy: { id: "asc" } })).id;
  const [r, r2] = await prisma.room.findMany({ where: { bookable: true, buildingId: "kronv" }, orderBy: { number: "asc" }, take: 2 });
  room = { id: r.id, number: r.number, buildingId: r.buildingId };
  room2 = { id: r2.id, number: r2.number };
  // Сотрудник другого факультета — настоящая граница StaffProfile.
  const foreignFaculty = await prisma.faculty.findFirstOrThrow({ where: { code: { not: staff.facultyCode } } });
  const id = randomUUID();
  await prisma.user.create({ data: { id, name: "Сотрудник другого факультета", email: `${id}@test.example`, role: "staff" } });
  userIds.push(id);
  const profile = await prisma.staffProfile.create({ data: { userId: id, position: "Сотрудник деканата", facultyCode: foreignFaculty.code } });
  foreignStaff = { userId: id, staffId: profile.id, facultyCode: profile.facultyCode };
});

beforeEach(() => {
  vi.mocked(session.requireStaff).mockResolvedValue(staff);
  vi.mocked(session.requireStudent).mockResolvedValue(student);
});

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { lessonId: { in: lessonIds } } });
  await prisma.roomBooking.deleteMany({ where: { purpose: "Тест переноса" } });
  await prisma.lesson.deleteMany({ where: { id: { in: lessonIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("перенос и отмена пары сотрудником", () => {
  it("сотрудник другого факультета не видит и не меняет пару: 404, база не тронута", async () => {
    const d = nextDay();
    const l = await makeLesson("08:00", "09:30", d);
    const expected = await versionOf(l.id);
    vi.mocked(session.requireStaff).mockResolvedValue(foreignStaff);
    expect((await listFacultyLessons()).lessons.some((x) => x.id === l.id)).toBe(false);
    await expect404(getFacultyLesson(l.id));
    await expect404(move(l.id, expected, d));
    const after = await prisma.lesson.findUniqueOrThrow({ where: { id: l.id } });
    expect(after.status).toBe("SCHEDULED");
    expect(await prisma.lessonChange.count({ where: { lessonId: l.id } })).toBe(0);
  });

  it("перенос времени: пара, история и уведомление всей группе в одной транзакции; студент видит «Изменено»", async () => {
    const d = nextDay();
    const l = await makeLesson("08:00", "09:30", d);
    const res = await move(l.id, await versionOf(l.id), d);
    expect(res.ok).toBe(true);
    const after = await prisma.lesson.findUniqueOrThrow({ where: { id: l.id } });
    expect(after.status).toBe("RESCHEDULED");
    expect(after.startsAt).toEqual(at("20:15", d));
    const change = await prisma.lessonChange.findFirstOrThrow({ where: { lessonId: l.id } });
    expect(change.previousStartsAt).toEqual(at("08:00", d));
    expect(change.reason).toBe("Аудитория на ремонте");
    const note = await prisma.notification.findFirstOrThrow({ where: { lessonId: l.id }, include: { recipients: true } });
    const group = await prisma.studentProfile.count({ where: { groupId: student.groupId } });
    expect(note.kind).toBe("SCHEDULE_CHANGE");
    expect(note.recipients).toHaveLength(group);
    // Студент группы — в своём расписании видит изменение.
    const mine = (await getMySchedule({ from: at("00:00", d), to: at("23:59", d) })).find((x) => x.id === l.id);
    expect(mine?.status).toBe("RESCHEDULED");
    expect(mine?.change?.reason).toBe("Аудитория на ремонте");
  });

  it("устаревшая карточка: второе изменение по старой версии не применяется", async () => {
    const d = nextDay();
    const l = await makeLesson("08:00", "09:30", d);
    const stale = await versionOf(l.id);
    expect((await move(l.id, stale, d)).ok).toBe(true);
    const again = await move(l.id, stale, d, { start: "20:30", end: "21:30" });
    expect(again).toEqual({ ok: false, message: "Пару уже изменили. Обновите страницу и проверьте историю." });
    expect(await prisma.lessonChange.count({ where: { lessonId: l.id } })).toBe(1);
  });

  it("накладки: у группы другая пара, аудитория занята бронью студента — отказ, база не тронута", async () => {
    const d = nextDay();
    const other = await makeLesson("20:15", "21:00", d);
    const l = await makeLesson("08:00", "09:30", d);
    const group = await move(l.id, await versionOf(l.id), d, { start: "20:30", end: "21:30" });
    expect(group.ok).toBe(false);
    expect(group.message).toMatch(/У группы в это время другая пара/);

    const d2 = nextDay();
    const l2 = await makeLesson("08:00", "09:30", d2);
    await prisma.roomBooking.create({ data: { roomId: room.id, studentId: student.studentId, startsAt: at("20:30", d2), endsAt: at("21:00", d2), purpose: "Тест переноса" } });
    const busy = await move(l2.id, await versionOf(l2.id), d2, { building: room.buildingId, room: room.number });
    expect(busy.ok).toBe(false);
    expect(busy.message).toMatch(/забронирована студентом/);
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("SCHEDULED");
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: l2.id } })).status).toBe("SCHEDULED");
    expect(other.status).toBe("SCHEDULED");
  });

  it("аудитория — только со схемы корпуса; при выборе корпуса нужен номер", async () => {
    const d = nextDay();
    const l = await makeLesson("08:00", "09:30", d);
    const v = await versionOf(l.id);
    expect((await move(l.id, v, d, { building: "kronv", room: "9999" })).message).toMatch(/нет аудитории 9999/);
    expect((await move(l.id, v, d, { building: "kronv", room: "" })).message).toBe("Укажите номер аудитории в выбранном корпусе");
    expect((await move(l.id, v, d, { building: "nope", room: "1206" })).message).toBe("Такого корпуса нет");
  });

  it("отмена: статус, история, уведомление; повторная отмена и прошедшая пара — отказ", async () => {
    const l = await makeLesson("08:00", "09:30", nextDay());
    const v = await versionOf(l.id);
    const res = await rescheduleFacultyLesson({ action: "cancel", id: l.id, expected: v, reason: "Болезнь преподавателя" });
    expect(res.ok).toBe(true);
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("CANCELLED");
    const cancelled = await getFacultyLesson(l.id);
    expect((await rescheduleFacultyLesson({ action: "cancel", id: l.id, expected: cancelled.version, reason: "Ещё раз" })).message).toBe("Пара уже отменена");

    const past = await makeLesson("08:00", "09:30", mskDayKey(addDays(new Date(), -2)));
    const pv = lessonVersion({ ...past, building: { id: past.buildingId! } });
    expect((await rescheduleFacultyLesson({ action: "cancel", id: past.id, expected: pv, reason: "Болезнь преподавателя" })).message).toBe("Пара уже прошла — её не изменить");
  });

  it("две пары одной группы параллельно на одно время в разные аудитории — проходит только одна", async () => {
    const d = nextDay();
    const a = await makeLesson("08:00", "09:30", d);
    const b = await makeLesson("10:00", "11:30", d);
    const [va, vb] = [await versionOf(a.id), await versionOf(b.id)];
    const results = await Promise.all([
      move(a.id, va, d, { building: room.buildingId, room: room.number }),
      move(b.id, vb, d, { building: room.buildingId, room: room2.number }),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)?.message).toMatch(/У группы в это время другая пара/);
  });
});

describe("«Вернуть как было» и откат действий сотрудника", () => {
  const restore = async (id: string) => rescheduleFacultyLesson({ action: "restore", id, expected: await versionOf(id) });
  // Исходная пара — вечером (утром в эти дни у группы пары seed), перенос — на тот же час другого дня.

  it("перенос → вернуть: время и место как были, записи и уведомления сотрудника удалены, группе — новое уведомление", async () => {
    const d = nextDay();
    const l = await makeLesson("20:15", "21:30", d);
    expect((await move(l.id, await versionOf(l.id), nextDay(), { building: room.buildingId, room: room.number })).ok).toBe(true);
    expect((await getFacultyLesson(l.id)).original?.previousStartsAt).toEqual(at("20:15", d));

    const res = await restore(l.id);
    expect(res).toMatchObject({ ok: true });
    const after = await prisma.lesson.findUniqueOrThrow({ where: { id: l.id } });
    expect(after).toMatchObject({ status: "SCHEDULED", startsAt: at("20:15", d), endsAt: at("21:30", d), room: "ауд. 9999", buildingId: room.buildingId, roomId: null, online: false });
    expect(await prisma.lessonChange.count({ where: { lessonId: l.id } })).toBe(0);
    const notes = await prisma.notification.findMany({ where: { lessonId: l.id }, include: { _count: { select: { recipients: true } } } });
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ title: expect.stringMatching(/^Снова по расписанию/), staffId: staff.staffId });
    expect(notes[0]._count.recipients).toBe(await prisma.studentProfile.count({ where: { groupId: student.groupId } }));
    // Студент видит пару без пометки об изменении; вернуть второй раз нечего.
    const mine = (await getMySchedule({ from: at("00:00", d), to: at("23:59", d) })).find((x) => x.id === l.id);
    expect(mine).toMatchObject({ status: "SCHEDULED", change: null });
    expect((await restore(l.id)).message).toBe("Деканат эту пару не менял — возвращать нечего");
  });

  it("отмена → вернуть; изменения из демо-данных остаются; онлайн-пара снова онлайн", async () => {
    const d = nextDay();
    const l = await makeLesson("20:15", "21:30", d);
    // Как в seed: перенос без автора, пара «Изменено» и онлайн.
    await prisma.lesson.update({ where: { id: l.id }, data: { status: "RESCHEDULED", online: true, room: null, buildingId: null } });
    await prisma.lessonChange.create({
      data: { lessonId: l.id, previousStatus: "SCHEDULED", newStatus: "RESCHEDULED", previousStartsAt: at("19:00", d), previousEndsAt: at("20:00", d), newStartsAt: at("20:15", d), newEndsAt: at("21:30", d), reason: "Демо" },
    });
    expect((await rescheduleFacultyLesson({ action: "cancel", id: l.id, expected: await versionOf(l.id), reason: "Болезнь преподавателя" })).ok).toBe(true);
    expect((await move(l.id, await versionOf(l.id), d)).message).toBe("Пара уже отменена");
    expect(await restore(l.id)).toMatchObject({ ok: true });
    const after = await prisma.lesson.findUniqueOrThrow({ where: { id: l.id }, include: { changes: true } });
    expect(after).toMatchObject({ status: "RESCHEDULED", online: true, startsAt: at("20:15", d) });
    expect(after.changes.map((c) => c.reason)).toEqual(["Демо"]);
  });

  it("исходное время заняла бронь студента — вернуть нельзя, база не тронута; чужой факультет — 404", async () => {
    const d = nextDay();
    const l = await prisma.lesson.create({
      data: { offeringId, kind: "PRACTICE", startsAt: at("20:15", d), endsAt: at("21:30", d), buildingId: room.buildingId, room: `ауд. ${room.number}`, roomId: room.id, status: "SCHEDULED" },
    });
    lessonIds.push(l.id);
    const d2 = nextDay();
    expect((await move(l.id, await versionOf(l.id), d2)).ok).toBe(true);
    await prisma.roomBooking.create({ data: { roomId: room.id, studentId: student.studentId, startsAt: at("20:30", d), endsAt: at("21:00", d), purpose: "Тест переноса" } });
    const res = await restore(l.id);
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/^Вернуть нельзя: аудитория забронирована студентом/);
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: l.id } })).startsAt).toEqual(at("20:15", d2));
    expect(await prisma.lessonChange.count({ where: { lessonId: l.id } })).toBe(1);

    const expected = await versionOf(l.id);
    vi.mocked(session.requireStaff).mockResolvedValue(foreignStaff);
    await expect404(rescheduleFacultyLesson({ action: "restore", id: l.id, expected }));
  });

  it("db:undo-staff: возвращает пары и удаляет объявления деканата; демо-уведомления и заявки не трогает", async () => {
    const d = nextDay();
    const l = await makeLesson("20:15", "21:00", d);
    const moved = await makeLesson("21:00", "21:30", d);
    expect((await rescheduleFacultyLesson({ action: "cancel", id: l.id, expected: await versionOf(l.id), reason: "Болезнь преподавателя" })).ok).toBe(true);
    expect((await move(moved.id, await versionOf(moved.id), nextDay())).ok).toBe(true);
    const ann = await prisma.notification.create({ data: { kind: "ANNOUNCEMENT", title: "Тест отката", body: "Объявление сотрудника", staffId: staff.staffId } });
    const demo = await prisma.notification.count({ where: { staffId: null } });
    const requests = await prisma.requestEvent.count();

    expect((await undoStaffChanges({ dryRun: true })).restored).toBeGreaterThanOrEqual(2);
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: l.id } })).status).toBe("CANCELLED");

    // Пары прошлых тестов, чьё исходное время занято (бронь выше), остаются как есть и попадают в skipped.
    const r = await undoStaffChanges();
    const skipped = r.skipped.map((x) => x.lessonId);
    expect(skipped).not.toContain(l.id);
    expect(skipped).not.toContain(moved.id);
    expect(await prisma.lesson.findUniqueOrThrow({ where: { id: l.id } })).toMatchObject({ status: "SCHEDULED", startsAt: at("20:15", d) });
    expect(await prisma.lesson.findUniqueOrThrow({ where: { id: moved.id } })).toMatchObject({ status: "SCHEDULED", startsAt: at("21:00", d) });
    expect(await prisma.lessonChange.count({ where: { staffId: { not: null }, lessonId: { notIn: skipped } } })).toBe(0);
    expect(await prisma.notification.count({ where: { id: ann.id } })).toBe(0);
    expect(await prisma.notification.count({ where: { staffId: { not: null }, OR: [{ lessonId: null }, { lessonId: { notIn: skipped } }] } })).toBe(0);
    // Пара, которую вернуть не удалось, остаётся изменённой — и уведомление о ней у студентов тоже.
    expect(skipped.length).toBeGreaterThan(0);
    expect(await prisma.notification.count({ where: { staffId: { not: null }, lessonId: { in: skipped } } })).toBeGreaterThan(0);
    expect(await prisma.notification.count({ where: { staffId: null } })).toBe(demo);
    expect(await prisma.requestEvent.count()).toBe(requests);
  });
});
