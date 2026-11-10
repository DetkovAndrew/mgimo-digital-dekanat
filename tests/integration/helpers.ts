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
