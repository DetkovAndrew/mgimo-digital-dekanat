import { z } from "zod";

// Электронная справка об обучении (docs/plans/certificates.md). Общий код без секретов: формат номера,
// схема снимка данных и сокращение ФИО для открытой страницы проверки.

export const formatDocumentNumber = (n: number) => `С-${String(n).padStart(6, "0")}`;

/** Токен проверки: 16 случайных байт в base64url. Формат проверяется до запроса к БД. */
export const VERIFY_TOKEN = /^[A-Za-z0-9_-]{22}$/;
export const verifyPath = (token: string) => `/verify/${token}`;

/** Электронный PDF выпускается только для справки об обучении с форматом «электронная». */
export const issuesCertificate = (type: string, payload: unknown) =>
  type === "study_certificate" && (payload as { format?: unknown } | null)?.format === "electronic";

const line = z.string().trim().min(1).max(200);

/** Снимок на дату выдачи: PDF и страница проверки строятся только из него, а не из текущего профиля. */
export const CertificateContent = z.object({
  v: z.literal(1),
  fullName: line,
  faculty: line,
  program: line,
  profile: line.nullable(),
  level: line,
  course: z.number().int().min(1).max(6),
  group: line,
  studyForm: line,
  funding: line,
  enrolledAt: z.iso.date(),
  destination: line,
});
export type CertificateContent = z.infer<typeof CertificateContent>;

/** «Морозова Алина Витальевна» → «Морозова А. В.»: открытая страница показывает только фамилию и инициалы. */
export function shortName(fullName: string): string {
  const [last = "", ...rest] = fullName.trim().split(/\s+/);
  return [last, ...rest.map((part) => `${Array.from(part)[0]?.toUpperCase() ?? ""}.`)].join(" ");
}

/** Что видит любой обладатель ссылки из QR. Других полей у этого типа нет. */
export type PublicCertificate = {
  number: string;
  title: "Справка об обучении";
  issuedAt: Date;
  holder: string;
  faculty: string;
  course: number;
  studyForm: string;
};
