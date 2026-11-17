// Объявления деканата: получатели — только студенты факультета сотрудника (весь факультет, курс или группа).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ANNOUNCE_LIMIT } from "@/lib/staff/announcements";
import { prisma } from "@/server/db";
import { sendFacultyAnnouncement } from "@/server/dal/staff-announcements";
import * as session from "@/server/session";

vi.mock("@/server/session", () => ({ requireStudent: vi.fn(), requireStaff: vi.fn(), getCurrentRole: vi.fn() }));

const TITLE = "Тест объявления";
let staff: session.StaffContext;
const as = (staffId: string) => vi.mocked(session.requireStaff).mockResolvedValue({ ...staff, staffId });
const send = (over: Record<string, unknown> = {}) =>
  sendFacultyAnnouncement({ audience: "faculty", course: "", group: "", title: TITLE, body: "Консультации переносятся на пятницу.", important: false, ...over });
const recipientsOfLast = async () => {
  const n = await prisma.notification.findFirstOrThrow({ where: { title: TITLE }, orderBy: { publishedAt: "desc" }, include: { recipients: { include: { user: { include: { student: { include: { group: true } } } } } } } });
  return n.recipients.map((r) => r.user.student!.group);
};

beforeAll(async () => {
  const user = await prisma.user.findFirstOrThrow({ where: { username: "dekanat.fhb" }, include: { staff: true } });
  staff = { userId: user.id, staffId: user.staff!.id, facultyCode: user.staff!.facultyCode };
});
beforeEach(() => void as(`ann-${Math.random()}`)); // свой счётчик частоты у каждого теста
afterAll(async () => {
  await prisma.notification.deleteMany({ where: { title: TITLE } });
  await prisma.$disconnect();
});

describe("объявления деканата", () => {
  it("всему факультету: все студенты факультета и никого с других факультетов", async () => {
    expect((await send()).ok).toBe(true);
    const groups = await recipientsOfLast();
    expect(groups.every((g) => g.facultyCode === staff.facultyCode)).toBe(true);
    expect(groups).toHaveLength(await prisma.studentProfile.count({ where: { group: { facultyCode: staff.facultyCode } } }));
  });

  it("курсу и группе — только они; группа чужого факультета — отказ, ничего не создано", async () => {
    const g = await prisma.studyGroup.findFirstOrThrow({ where: { facultyCode: staff.facultyCode, students: { some: {} } } });
    expect((await send({ audience: "course", course: String(g.course) })).ok).toBe(true);
    expect((await recipientsOfLast()).every((x) => x.course === g.course && x.facultyCode === staff.facultyCode)).toBe(true);
    expect((await send({ audience: "group", group: g.code })).ok).toBe(true);
    expect((await recipientsOfLast()).every((x) => x.code === g.code)).toBe(true);

    const foreign = await prisma.studyGroup.findFirstOrThrow({ where: { facultyCode: { not: staff.facultyCode }, students: { some: {} } } });
    const before = await prisma.notification.count({ where: { title: TITLE } });
    expect(await send({ audience: "group", group: foreign.code })).toEqual({ ok: false, message: "Такой группы на вашем факультете нет" });
    expect(await prisma.notification.count({ where: { title: TITLE } })).toBe(before);
  });

  it(`не больше ${ANNOUNCE_LIMIT.perHour} в час с одного аккаунта`, async () => {
    as("ann-rate");
    for (let i = 0; i < ANNOUNCE_LIMIT.perHour; i++) expect((await send({ audience: "group", group: (await prisma.studyGroup.findFirstOrThrow({ where: { facultyCode: staff.facultyCode, students: { some: {} } } })).code })).ok).toBe(true);
    expect((await send()).message).toMatch(/Не больше 10 объявлений в час/);
  });
});
