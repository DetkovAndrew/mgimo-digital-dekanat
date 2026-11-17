// Объявления деканата: получатели — только студенты факультета сотрудника (весь факультет, курс или группа).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ANNOUNCE_LIMIT } from "@/lib/staff/announcements";
import { prisma } from "@/server/db";
import { sendFacultyAnnouncement, withdrawFacultyAnnouncement } from "@/server/dal/staff-announcements";
import * as session from "@/server/session";
import { expect404 } from "./helpers";

vi.mock("@/server/session", () => ({ requireStudent: vi.fn(), requireStaff: vi.fn(), getCurrentRole: vi.fn() }));

const TITLE = "Тест объявления";
let staff: session.StaffContext;
const userIds: string[] = [];
// Новый сотрудник (по умолчанию того же факультета) — свой счётчик частоты; автор объявления — настоящий StaffProfile.
async function newStaff(facultyCode = staff.facultyCode) {
  const id = crypto.randomUUID();
  await prisma.user.create({ data: { id, name: "Тестовый сотрудник", email: `${id}@test.example`, role: "staff" } });
  userIds.push(id);
  const profile = await prisma.staffProfile.create({ data: { userId: id, position: "Сотрудник деканата", facultyCode } });
  const ctx = { userId: id, staffId: profile.id, facultyCode };
  vi.mocked(session.requireStaff).mockResolvedValue(ctx);
  return ctx;
}
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
beforeEach(() => newStaff().then(() => undefined));
afterAll(async () => {
  await prisma.notification.deleteMany({ where: { title: TITLE } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
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
    for (let i = 0; i < ANNOUNCE_LIMIT.perHour; i++) expect((await send({ audience: "group", group: (await prisma.studyGroup.findFirstOrThrow({ where: { facultyCode: staff.facultyCode, students: { some: {} } } })).code })).ok).toBe(true);
    expect((await send()).message).toMatch(/Не больше 10 объявлений в час/);
  });

  it("отозвать: объявление сотрудника своего факультета исчезает у всех; чужой факультет и демо-объявление — 404", async () => {
    const author = await newStaff();
    expect((await send()).ok).toBe(true);
    const n = await prisma.notification.findFirstOrThrow({ where: { title: TITLE, staffId: author.staffId } });

    const foreign = await prisma.faculty.findFirstOrThrow({ where: { code: { not: staff.facultyCode } } });
    await newStaff(foreign.code);
    await expect404(withdrawFacultyAnnouncement(n.id));
    expect(await prisma.notification.count({ where: { id: n.id } })).toBe(1);

    await newStaff(); // другой сотрудник того же деканата может отозвать
    const demo = await prisma.notification.findFirstOrThrow({ where: { kind: "ANNOUNCEMENT", staffId: null } });
    await expect404(withdrawFacultyAnnouncement(demo.id));
    expect((await withdrawFacultyAnnouncement(n.id)).ok).toBe(true);
    expect(await prisma.notification.count({ where: { id: n.id } })).toBe(0);
    expect(await prisma.notificationRecipient.count({ where: { notificationId: n.id } })).toBe(0);
  });
});
