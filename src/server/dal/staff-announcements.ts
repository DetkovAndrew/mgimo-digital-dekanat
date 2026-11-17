import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { ANNOUNCE_LIMIT, announcementSchema, type AnnounceActionState } from "@/lib/staff/announcements";
import { prisma } from "../db";
import { requireStaff } from "../session";

// Объявления деканата (уведомление ANNOUNCEMENT): только студентам факультета сотрудника — всем, курсу или группе.
// Получателей выбирает сервер по факультету из сессии: код группы из формы — лишь селектор внутри факультета.
// Демо-аккаунты общие для жюри, поэтому частота ограничена. Счётчик в памяти: сервер — один процесс Node (как у помощника).

const sent = new Map<string, number[]>();

function takeSlot(staffId: string, now = Date.now()) {
  const recent = (sent.get(staffId) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= ANNOUNCE_LIMIT.perHour) return false;
  sent.set(staffId, [...recent, now]);
  return true;
}

/** Для формы: группы и курсы факультета; для списка — последние объявления, дошедшие до студентов факультета. */
export async function getFacultyAnnouncements() {
  const { facultyCode } = await requireStaff();
  const [groups, recent] = await Promise.all([
    prisma.studyGroup.findMany({ where: { facultyCode }, orderBy: [{ course: "asc" }, { code: "asc" }], select: { code: true, course: true } }),
    prisma.notification.findMany({
      where: { kind: "ANNOUNCEMENT", recipients: { some: { user: { student: { group: { facultyCode } } } } } },
      orderBy: { publishedAt: "desc" },
      take: 10,
      select: { id: true, title: true, body: true, important: true, publishedAt: true, _count: { select: { recipients: true } } },
    }),
  ]);
  return { groups, courses: [...new Set(groups.map((g) => g.course))], recent };
}

export async function sendFacultyAnnouncement(input: unknown): Promise<AnnounceActionState> {
  const { facultyCode, staffId } = await requireStaff();
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте объявление" };
  const v = parsed.data;

  const group: Prisma.StudyGroupWhereInput =
    v.audience === "group" ? { facultyCode, code: v.group } : v.audience === "course" ? { facultyCode, course: Number(v.course) } : { facultyCode };
  const students = await prisma.studentProfile.findMany({ where: { group }, select: { userId: true } });
  if (!students.length) return { ok: false, message: v.audience === "group" ? "Такой группы на вашем факультете нет" : "Получателей нет: на этом курсе нет студентов" };
  if (!takeSlot(staffId)) return { ok: false, message: `Не больше ${ANNOUNCE_LIMIT.perHour} объявлений в час. Попробуйте позже.` };

  await prisma.notification.create({
    data: {
      kind: "ANNOUNCEMENT",
      title: v.title,
      body: v.body,
      important: v.important,
      recipients: { create: students.map((s) => ({ userId: s.userId })) },
    },
  });
  return { ok: true, message: `Объявление отправлено. Получили студентов: ${students.length}.` };
}
