import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";
import { prisma } from "./db";

export type StudentContext = Readonly<{ userId: string; studentId: string; groupId: string }>;
export type StaffContext = Readonly<{ userId: string; staffId: string; facultyCode: string }>;

// Одна проверка сессии на запрос, даже если её вызывают несколько функций DAL.
const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Студент из серверной сессии. Нет сессии → на вход; не студент или нет профиля → 404. */
export const requireStudent = cache(async (): Promise<StudentContext> => {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "student") notFound();

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, groupId: true },
  });
  if (!profile) notFound();

  return Object.freeze({ userId: session.user.id, studentId: profile.id, groupId: profile.groupId });
});

/** Сотрудник деканата. Доступ к данным студентов дополнительно ограничивается facultyCode. */
export const requireStaff = cache(async (): Promise<StaffContext> => {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.user.role !== "staff") notFound();

  const profile = await prisma.staffProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, facultyCode: true },
  });
  if (!profile) notFound();

  return Object.freeze({ userId: session.user.id, staffId: profile.id, facultyCode: profile.facultyCode });
});

/** Для страниц, которым нужно знать роль (например, куда вести после входа). */
export async function getCurrentRole(): Promise<"student" | "staff" | null> {
  const session = await getSession();
  const role = session?.user.role;
  return role === "student" || role === "staff" ? role : null;
}
