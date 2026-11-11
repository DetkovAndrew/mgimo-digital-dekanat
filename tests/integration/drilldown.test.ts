// Страницы раскрытия: пара, дисциплина, преподаватель, корпус (план docs/plans/drilldown.md, ревью Codex 10).
// A и C — одна группа (общие пары, свои баллы и записи), B — другая группа.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { addDays, mskStartOfDay } from "@/lib/format";
import { prisma } from "@/server/db";
import { getBuilding } from "@/server/dal/buildings";
import { getMyCourse } from "@/server/dal/courses";
import { getMyLesson } from "@/server/dal/lessons";
import { getTeacher } from "@/server/dal/teachers";
import { actAs, expect404 } from "./helpers";

vi.mock("@/server/session", () => ({ requireStudent: vi.fn(), requireStaff: vi.fn(), getCurrentRole: vi.fn() }));

let A: Awaited<ReturnType<typeof actAs>>;
let B: Awaited<ReturnType<typeof actAs>>;
let C: Awaited<ReturnType<typeof actAs>>;

beforeAll(async () => {
  A = await actAs("alina.lebedeva");
  B = await actAs("timur.orlov");
  C = await actAs("demo.classmate");
  expect(C.groupId).toBe(A.groupId);
  expect(B.groupId).not.toBe(A.groupId);
});

afterAll(() => prisma.$disconnect());

describe("пара и дисциплина", () => {
  it("A не открывает пару и дисциплину группы B — 404", async () => {
    const bLesson = await prisma.lesson.findFirstOrThrow({ where: { offering: { groupId: B.groupId } } });
    await actAs("alina.lebedeva");
    await expect404(getMyLesson(bLesson.id));
    await expect404(getMyCourse(bLesson.offeringId));
  });

  it("несуществующие id — 404 на всех страницах раскрытия", async () => {
    await actAs("alina.lebedeva");
    for (const call of [getMyLesson, getMyCourse, getTeacher, getBuilding]) await expect404(call("no-such-id"));
  });

  it("в дисциплине своей группы — только свои результаты, не одногруппника", async () => {
    const offering = await prisma.courseOffering.findFirstOrThrow({
      where: { groupId: A.groupId, assessments: { some: { results: { some: { studentId: C.studentId } } } } },
    });
    for (const who of [A, C]) {
      await actAs(who === A ? "alina.lebedeva" : "demo.classmate");
      const course = await getMyCourse(offering.id);
      const shown = course.assessments.flatMap((a) => a.results).length;
      const own = await prisma.gradeResult.count({ where: { studentId: who.studentId, assessment: { offeringId: offering.id } } });
      expect(shown).toBe(own);
    }
    // Баллы у A и C разные — значит, выборка действительно по студенту, а не по группе.
    await actAs("alina.lebedeva");
    const a = (await getMyCourse(offering.id)).assessments.map((x) => x.results[0]?.points ?? null);
    await actAs("demo.classmate");
    const c = (await getMyCourse(offering.id)).assessments.map((x) => x.results[0]?.points ?? null);
    expect(a).not.toEqual(c);
  });

  it("пара своей группы открывается, преподаватель — фактический (с учётом замены)", async () => {
    const replaced = await prisma.lesson.findFirstOrThrow({
      where: { offering: { groupId: A.groupId }, teacherId: { not: null } },
    });
    await actAs("alina.lebedeva");
    const l = await getMyLesson(replaced.id);
    expect(l.teacher.id).toBe(replaced.teacherId);
  });
});

describe("публичный профиль преподавателя", () => {
  const ALLOWED = ["lessonId", "mine", "kind", "startsAt", "endsAt", "room", "online", "status", "building", "title", "group"];

  it("отдаёт только разрешённые поля; пары чужих групп — без id", async () => {
    // Преподаватель, который ведёт и у A, и у B.
    const teacher = await prisma.teacher.findFirstOrThrow({
      where: {
        AND: [
          { offerings: { some: { groupId: A.groupId } } },
          { offerings: { some: { groupId: B.groupId } } },
        ],
      },
    });
    await actAs("alina.lebedeva");
    const t = await getTeacher(teacher.id);
    expect(Object.keys(t).sort()).toEqual(["fullName", "id", "myCourses", "position", "schedule"]);
    expect(t.schedule.length).toBeGreaterThan(0);
    for (const item of t.schedule) {
      expect(Object.keys(item).sort()).toEqual([...ALLOWED].sort());
      expect(Object.keys(item.building ?? {}).every((k) => k === "id" || k === "title")).toBe(true);
      if (!item.mine) expect(item.lessonId).toBeNull();
    }
    const mineIds = t.schedule.filter((x) => x.mine).map((x) => x.lessonId!);
    const foreign = await prisma.lesson.count({ where: { id: { in: mineIds }, offering: { groupId: { not: A.groupId } } } });
    expect(foreign).toBe(0);
    expect(JSON.stringify(t)).not.toMatch(/studentId|results|reason|changes|bookings/);
  });

  it("преподавателя только чужой группы можно открыть: «ведёт у вас» пусто", async () => {
    const onlyB = await prisma.teacher.findFirstOrThrow({
      where: { offerings: { some: { groupId: B.groupId }, none: { groupId: A.groupId } }, lessons: { none: { offering: { groupId: A.groupId } } } },
    });
    await actAs("alina.lebedeva");
    const t = await getTeacher(onlyB.id);
    expect(t.myCourses).toEqual([]);
    expect(t.schedule.length).toBeGreaterThan(0);
    expect(t.schedule.every((x) => !x.mine && x.lessonId === null)).toBe(true);
  });
});

describe("замена преподавателя", () => {
  it("пара с явной заменой — в расписании заменяющего, не у ведущего", async () => {
    const from = mskStartOfDay(new Date());
    const replaced = await prisma.lesson.findFirstOrThrow({
      where: { offering: { groupId: A.groupId }, teacherId: { not: null }, startsAt: { gte: from, lt: addDays(from, 7) } },
      include: { offering: true },
    });
    expect(replaced.teacherId).not.toBe(replaced.offering.leadTeacherId);
    await actAs("alina.lebedeva");
    const lead = await getTeacher(replaced.offering.leadTeacherId);
    const sub = await getTeacher(replaced.teacherId!);
    expect(lead.schedule.map((x) => x.lessonId)).not.toContain(replaced.id);
    expect(sub.schedule.map((x) => x.lessonId)).toContain(replaced.id);
  });
});

describe("корпус", () => {
  it("в списке только пары группы A и тренировки самого A, не одногруппника", async () => {
    const cBooking = await prisma.sportBooking.findFirstOrThrow({ where: { studentId: C.studentId }, include: { slot: true } });
    // Своя тренировка A в том же корпусе в ближайшие дни — должна появиться в списке.
    const aSlot = await prisma.sportSlot.findFirstOrThrow({
      where: {
        buildingId: cBooking.slot.buildingId,
        id: { not: cBooking.slotId },
        startsAt: { gte: new Date(), lt: addDays(mskStartOfDay(new Date()), 7) },
      },
    });
    const aBooking = await prisma.sportBooking.upsert({
      where: { studentId_slotId: { studentId: A.studentId, slotId: aSlot.id } },
      update: { status: "CONFIRMED" },
      create: { studentId: A.studentId, slotId: aSlot.id, weekStart: aSlot.weekStart, status: "CONFIRMED" },
    });
    await actAs("alina.lebedeva");
    const b = await getBuilding(cBooking.slot.buildingId);
    expect(b.visits.map((v) => v.key)).toContain(`sport-${aBooking.id}`);
    expect(b.visits.map((v) => v.key)).not.toContain(`sport-${cBooking.id}`);

    const lessonIds = b.visits.filter((v) => v.href.startsWith("/lessons/")).map((v) => v.key);
    const foreign = await prisma.lesson.count({ where: { id: { in: lessonIds }, offering: { groupId: { not: A.groupId } } } });
    expect(foreign).toBe(0);
    const sportIds = b.visits.filter((v) => v.key.startsWith("sport-")).map((v) => v.key.slice(6));
    expect(await prisma.sportBooking.count({ where: { id: { in: sportIds }, studentId: { not: A.studentId } } })).toBe(0);
  });

  it("онлайн-пара с указанным корпусом — не посещение корпуса", async () => {
    const from = mskStartOfDay(new Date());
    const lesson = await prisma.lesson.findFirstOrThrow({
      where: { offering: { groupId: A.groupId }, buildingId: { not: null }, online: false, startsAt: { gte: from, lt: addDays(from, 7) } },
    });
    await prisma.lesson.update({ where: { id: lesson.id }, data: { online: true } });
    try {
      await actAs("alina.lebedeva");
      expect((await getBuilding(lesson.buildingId!)).visits.map((v) => v.key)).not.toContain(lesson.id);
    } finally {
      await prisma.lesson.update({ where: { id: lesson.id }, data: { online: false } });
    }
  });

  it("корпус без моих занятий — пустой список, не 404", async () => {
    const used = await prisma.lesson.findMany({ where: { offering: { groupId: A.groupId } }, distinct: ["buildingId"], select: { buildingId: true } });
    const empty = await prisma.building.findFirstOrThrow({
      where: { id: { notIn: used.map((u) => u.buildingId).filter((x): x is string => !!x) }, sportSlots: { none: {} } },
    });
    await actAs("alina.lebedeva");
    expect((await getBuilding(empty.id)).visits).toEqual([]);
  });
});
