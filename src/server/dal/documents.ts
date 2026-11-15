import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import {
  CertificateContent, formatDocumentNumber, type PublicCertificate, shortName, VERIFY_TOKEN, verifyPath,
} from "@/lib/documents/certificate";
import { prisma } from "../db";
import { renderCertificatePdf } from "../documents/pdf";

// Электронные справки (docs/plans/certificates.md). Выпуск — только из changeFacultyRequest (сотрудник своего
// факультета, под блокировкой заявки). Скачивание — владелец через заявку. Проверка — любой обладатель ссылки из QR,
// только поля PublicCertificate из снимка.

type Tx = Prisma.TransactionClient;

/** Адрес проверки для QR и кнопки «Скопировать ссылку». Токен — секрет: в журналы и снимок помощника не попадает. */
export const verifyUrlFor = (token: string) =>
  new URL(verifyPath(token), process.env.BETTER_AUTH_URL ?? "http://localhost:3000").toString();

/** Снимок данных на дату выдачи. null — профиль неполный: сотрудник получает отказ до любых записей. */
export async function certificateContentFor(tx: Tx, requestId: string): Promise<CertificateContent | null> {
  const r = await tx.request.findUnique({
    where: { id: requestId },
    select: {
      payload: true,
      student: {
        select: {
          studyForm: true, funding: true, enrolledAt: true,
          user: { select: { name: true } },
          group: { select: { code: true, course: true, program: true, profile: true, level: true, faculty: { select: { title: true } } } },
        },
      },
    },
  });
  if (!r) return null;
  const { student: s } = r;
  const parsed = CertificateContent.safeParse({
    v: 1,
    fullName: s.user.name,
    faculty: s.group.faculty.title,
    program: s.group.program,
    profile: s.group.profile,
    level: s.group.level,
    course: s.group.course,
    group: s.group.code,
    studyForm: s.studyForm,
    funding: s.funding,
    enrolledAt: s.enrolledAt.toISOString().slice(0, 10),
    destination: (r.payload as { destination?: unknown } | null)?.destination,
  });
  return parsed.success ? parsed.data : null;
}

/** Внутри транзакции сотрудника: одна справка на заявку (уникальный requestId). */
export function issueCertificate(tx: Tx, requestId: string, content: CertificateContent, at: Date) {
  return tx.issuedDocument.create({
    data: { requestId, kind: "study_certificate", verifyToken: randomBytes(16).toString("base64url"), content, issuedAt: at },
    select: { number: true },
  });
}

/** PDF своей справки; studentId — только из studentForApi() в обработчике маршрута. Чужая или нет — null. */
export async function readMyCertificatePdf(studentId: string, requestId: unknown) {
  if (typeof requestId !== "string" || !requestId || requestId.length > 64) return null;
  const doc = await prisma.issuedDocument.findFirst({
    where: { requestId, request: { studentId } },
    select: { number: true, verifyToken: true, content: true, issuedAt: true },
  });
  const content = CertificateContent.safeParse(doc?.content);
  if (!doc || !content.success) return null;
  const number = formatDocumentNumber(doc.number);
  const bytes = await renderCertificatePdf({ number, issuedAt: doc.issuedAt, content: content.data, verifyUrl: verifyUrlFor(doc.verifyToken) });
  return { number, bytes };
}

/** Открытая проверка по токену из QR. Неверный формат и неизвестный токен неразличимы: null. */
export async function verifyCertificate(token: unknown): Promise<PublicCertificate | null> {
  if (typeof token !== "string" || !VERIFY_TOKEN.test(token)) return null;
  const doc = await prisma.issuedDocument.findUnique({
    where: { verifyToken: token },
    select: { number: true, kind: true, issuedAt: true, content: true },
  });
  if (doc?.kind !== "study_certificate") return null;
  const c = CertificateContent.safeParse(doc.content);
  if (!c.success) return null;
  return {
    number: formatDocumentNumber(doc.number),
    title: "Справка об обучении",
    issuedAt: doc.issuedAt,
    holder: shortName(c.data.fullName),
    faculty: c.data.faculty,
    course: c.data.course,
    studyForm: c.data.studyForm,
  };
}
