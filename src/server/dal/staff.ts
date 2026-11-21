import "server-only";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { formatDocumentNumber, issuesCertificate } from "@/lib/documents/certificate";
import { requestStatusLabel } from "@/lib/format";
import { formatRequestNumber, isRequestType, requestCatalog } from "@/lib/requests/catalog";
import { changeRequestSchema, isStaffFilter, requestPriority, type StaffActionState } from "@/lib/staff/requests";
import { prisma } from "../db";
import { requireStaff } from "../session";
import { pushAfterResponse } from "./push";
import { certificateContentFor, issueCertificate } from "./documents";

const facultyScope = (facultyCode: string) => ({
  student: { group: { faculty: { code: facultyCode } } },
}) satisfies Prisma.RequestWhereInput;

const listSelect = {
  id: true, number: true, type: true, status: true, createdAt: true, updatedAt: true,
  student: { select: { user: { select: { name: true } }, group: { select: { code: true, course: true } } } },
} satisfies Prisma.RequestSelect;

export async function listFacultyRequests(filter: unknown = "SUBMITTED") {
  const { facultyCode } = await requireStaff();
  if (!isStaffFilter(filter)) notFound();
  const rows = await prisma.request.findMany({
    where: { ...facultyScope(facultyCode), ...(filter === "ALL" ? {} : { status: filter }) },
    select: listSelect,
    orderBy: [{ createdAt: "asc" }, { number: "asc" }],
  });
  return rows.sort((a, b) => requestPriority(a.status) - requestPriority(b.status));
}

export async function getFacultyRequest(id: string) {
  const { facultyCode } = await requireStaff();
  const request = await prisma.request.findFirst({
    where: { id, ...facultyScope(facultyCode) },
    select: {
      ...listSelect, payload: true,
      document: { select: { number: true, issuedAt: true } }, // без токена: ссылка проверки только у студента
      events: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, actorType: true, fromStatus: true, toStatus: true, comment: true, createdAt: true },
      },
    },
  });
  if (!request) notFound();
  return request;
}

/** Ожидаемый статус приходит из открытой карточки; после блокировки сверяем его заново. */
export async function changeFacultyRequest(input: unknown): Promise<StaffActionState> {
  const { facultyCode, userId } = await requireStaff();
  const parsed = changeRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Проверьте данные" };
  const { id, fromStatus, toStatus, comment } = parsed.data;
  const where = { id, ...facultyScope(facultyCode) };

  let pushId: string | null = null; // уведомление студенту — на телефон после коммита
  const result = await prisma.$transaction(async (tx) => {
    // Блокируем только заявку своего факультета. Значения передаются параметрами tagged SQL.
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT r."id" FROM "request" r
      JOIN "student_profile" s ON s."id" = r."studentId"
      JOIN "study_group" g ON g."id" = s."groupId"
      JOIN "faculty" f ON f."code" = g."facultyCode"
      WHERE r."id" = ${id} AND f."code" = ${facultyCode}
      FOR UPDATE OF r
    `;
    if (!locked.length) notFound();
    const current = await tx.request.findFirst({
      where,
      select: {
        status: true, number: true, type: true, payload: true,
        student: { select: { userId: true } },
        document: { select: { number: true } },
        events: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { actorType: true, fromStatus: true, comment: true } },
      },
    });
    if (!current) notFound();
    if (current.status !== fromStatus) return { ok: false, message: "Статус уже изменился. Обновите страницу и проверьте историю." };

    // answerMyRequest переводит ответ студента в SUBMITTED. Не снимаем ожидание за него.
    if (fromStatus === "NEEDS_INFO" && toStatus === "IN_PROGRESS") {
      const answer = current.events[0];
      if (answer?.actorType !== "STUDENT" || answer.fromStatus !== "NEEDS_INFO" || !answer.comment?.trim()) {
        return { ok: false, message: "Дождитесь ответа студента. После ответа заявка появится во вкладке «Новые»." };
      }
    }

    // Электронная справка выпускается вместе с «Готово» (docs/plans/certificates.md). Снимок собирается и
    // проверяется до любых записей: при неполном профиле статус не меняется. Повторно не выпускается.
    const issue = toStatus === "READY" && issuesCertificate(current.type, current.payload) && !current.document;
    const content = issue ? await certificateContentFor(tx, id) : null;
    if (issue && !content) return { ok: false, message: "Не удалось выпустить справку: в профиле студента не хватает данных." };

    const at = new Date();
    const updated = await tx.request.updateMany({ where: { ...where, status: fromStatus }, data: { status: toStatus } });
    if (updated.count !== 1) return { ok: false, message: "Статус уже изменился. Обновите страницу." };
    await tx.requestEvent.create({
      data: { requestId: id, fromStatus, toStatus, actorType: "STAFF", actorUserId: userId, comment: comment || null, createdAt: at },
    });
    const document = content ? await issueCertificate(tx, id, content, at) : null;
    const issued = document ? ` Справка ${formatDocumentNumber(document.number)}: PDF в заявке.` : "";
    const title = isRequestType(current.type) ? requestCatalog[current.type].title : "Заявка";
    pushId = (await tx.notification.create({
      select: { id: true },
      data: {
        kind: "REQUEST_STATUS", requestId: id,
        title: `${title}: ${requestStatusLabel[toStatus].label.toLowerCase()}`,
        body: `${formatRequestNumber(current.number)}: ${requestStatusLabel[toStatus].label}.${issued}${comment ? ` ${comment}` : ""}`,
        important: toStatus === "NEEDS_INFO" || toStatus === "READY",
        recipients: { create: { userId: current.student.userId } },
      },
    })).id;
    return { ok: true, message: document ? `Статус сохранён, справка ${formatDocumentNumber(document.number)} выпущена. Студент получил уведомление.` : "Статус сохранён. Студент получил уведомление." };
  });
  pushAfterResponse(pushId);
  return result;
}
