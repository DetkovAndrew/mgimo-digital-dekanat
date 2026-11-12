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

// Общая проверка для страниц и API: кто вошёл и есть ли у него профиль студента.
const loadStudent = cache(async (): Promise<StudentContext | "anonymous" | "forbidden"> => {
  const session = await getSession();
  if (!session) return "anonymous";
  if (session.user.role !== "student") return "forbidden";

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: { id: true, groupId: true },
  });
  if (!profile) return "forbidden";

  return Object.freeze({ userId: session.user.id, studentId: profile.id, groupId: profile.groupId });
});

/** Студент из серверной сессии. Нет сессии → на вход; не студент или нет профиля → 404. */
export const requireStudent = cache(async (): Promise<StudentContext> => {
  const s = await loadStudent();
  if (s === "anonymous") redirect("/login");
  if (s === "forbidden") notFound();
  return s;
});

/** Для Route Handlers: без редиректов, чтобы API отвечал JSON 401/403. */
export async function studentForApi(): Promise<{ ok: true; student: StudentContext } | { ok: false; status: 401 | 403 }> {
  const s = await loadStudent();
  if (s === "anonymous") return { ok: false, status: 401 };
  if (s === "forbidden") return { ok: false, status: 403 };
  return { ok: true, student: s };
}

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
