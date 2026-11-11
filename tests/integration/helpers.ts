import { vi } from "vitest";
import { prisma } from "@/server/db";
import * as session from "@/server/session";

/** Подменяет серверную сессию: дальше DAL работает как будто вошёл этот студент. */
export async function actAs(username: string) {
  const user = await prisma.user.findFirstOrThrow({ where: { username }, include: { student: true } });
  if (!user.student) throw new Error(`${username} — не студент`);
  vi.mocked(session.requireStudent).mockResolvedValue(
    Object.freeze({ userId: user.id, studentId: user.student.id, groupId: user.student.groupId }),
  );
  return { userId: user.id, studentId: user.student.id, groupId: user.student.groupId };
}

/** Ожидание notFound() из next/navigation (404 без раскрытия существования объекта). */
export async function expect404(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    const digest = (e as { digest?: string }).digest ?? "";
    if (digest.includes("404")) return;
    throw e;
  }
  throw new Error("Ожидался 404, но запрос выполнился");
}

/** Новый студент без пар и записей (группа демо-участников) — для чистых проверок очереди. */
export async function makeStudent(username: string) {
  const group = await prisma.studyGroup.findFirstOrThrow({ where: { code: "SIM-0000" } });
  const user = await prisma.user.create({
    data: { id: crypto.randomUUID(), name: username, email: `${username}@test.example`, username, role: "student" },
  });
  await prisma.studentProfile.create({
    data: { userId: user.id, groupId: group.id, recordBookNumber: `T-${username}`, funding: "бюджет", enrolledAt: new Date("2026-09-01") },
  });
  return actAs(username);
}
