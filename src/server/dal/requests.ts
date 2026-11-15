import "server-only";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { isRequestType, requestCatalog, type RequestType } from "@/lib/requests/catalog";
import { prisma } from "../db";
import { requireStudent } from "../session";

const listSelect = {
  id: true,
  number: true,
  type: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RequestSelect;

export async function listMyRequests() {
  const { studentId } = await requireStudent();
  return prisma.request.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    select: listSelect,
  });
}

/** Заявка текущего студента. Чужая или несуществующая — 404 (не раскрываем существование). */
export async function getMyRequest(id: string) {
  const { studentId } = await requireStudent();
  const request = await prisma.request.findFirst({
    where: { id, studentId },
    select: {
      ...listSelect,
      payload: true,
      // Токен проверки — только в своей заявке: в списке заявок и снимке помощника его нет.
      document: { select: { number: true, issuedAt: true, verifyToken: true } },
      events: {
        orderBy: { createdAt: "asc" },
        select: { id: true, fromStatus: true, toStatus: true, actorType: true, comment: true, createdAt: true },
      },
    },
  });
  if (!request) notFound();
  return request;
}

export type CreateRequestResult =
  | { ok: true; id: string }
  | { ok: false; fieldErrors: Record<string, string[]>; formError?: string };

/** Подать заявку. Владелец — только из сессии; данные — только через схему типа. */
export async function createMyRequest(type: string, input: unknown): Promise<CreateRequestResult> {
  const { studentId, userId } = await requireStudent();
  if (!isRequestType(type)) return { ok: false, fieldErrors: {}, formError: "Неизвестный тип заявки" };

  const parsed = requestCatalog[type as RequestType].schema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { ok: false, fieldErrors };
  }

  const request = await prisma.request.create({
    data: {
      studentId,
      type,
      payload: parsed.data as Prisma.InputJsonObject,
      events: { create: { fromStatus: null, toStatus: "SUBMITTED", actorType: "STUDENT", actorUserId: userId } },
    },
    select: { id: true },
  });
  return { ok: true, id: request.id };
}

/** Отозвать заявку, пока деканат её не исполнил. */
export async function cancelMyRequest(id: string): Promise<{ ok: boolean }> {
  const { studentId, userId } = await requireStudent();
  const cancellable = ["SUBMITTED", "IN_PROGRESS", "NEEDS_INFO"] as const;

  return prisma.$transaction(async (tx) => {
    const current = await tx.request.findFirst({ where: { id, studentId }, select: { status: true } });
    if (!current) notFound();
    if (!(cancellable as readonly string[]).includes(current.status)) return { ok: false };

    // Условное обновление: владелец и прежний статус проверяются в самом UPDATE.
    const { count } = await tx.request.updateMany({
      where: { id, studentId, status: current.status },
      data: { status: "CANCELLED" },
    });
    if (count !== 1) return { ok: false };
    await tx.requestEvent.create({
      data: { requestId: id, fromStatus: current.status, toStatus: "CANCELLED", actorType: "STUDENT", actorUserId: userId },
    });
    return { ok: true };
  });
}

/** Ответить на запрос уточнения: NEEDS_INFO → SUBMITTED с комментарием студента. */
export async function answerMyRequest(id: string, comment: string): Promise<{ ok: boolean; error?: string }> {
  const { studentId, userId } = await requireStudent();
  const text = comment.trim();
  if (text.length < 2 || text.length > 2000) return { ok: false, error: "Ответ — от 2 до 2000 символов" };

  return prisma.$transaction(async (tx) => {
    const { count } = await tx.request.updateMany({
      where: { id, studentId, status: "NEEDS_INFO" },
      data: { status: "SUBMITTED" },
    });
    if (count !== 1) {
      const exists = await tx.request.count({ where: { id, studentId } });
      if (!exists) notFound();
      return { ok: false, error: "Заявка уже не ждёт уточнения" };
    }
    await tx.requestEvent.create({
      data: { requestId: id, fromStatus: "NEEDS_INFO", toStatus: "SUBMITTED", actorType: "STUDENT", actorUserId: userId, comment: text },
    });
    return { ok: true };
  });
}
