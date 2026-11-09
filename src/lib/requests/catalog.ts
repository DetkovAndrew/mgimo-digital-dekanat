import { z } from "zod";

// Каталог заявок и справок. Одна схема проверяет форму на клиенте и данные на сервере
// (сервер проверяет всегда, клиент — только для удобства).
// Сроки исполнения — демонстрационные, а не официальные нормы МГИМО.

export type FieldKind = "text" | "textarea" | "number" | "select" | "date" | "month";

export type FieldSpec = {
  name: string;
  label: string;
  kind: FieldKind;
  hint?: string;
  options?: readonly { value: string; label: string }[];
  optional?: boolean;
};

export type RequestCategory = "certificate" | "application" | "question";

export type RequestTypeSpec = {
  title: string;
  description: string;
  category: RequestCategory;
  /** Ориентировочный срок в рабочих днях (демо). */
  slaDays: number;
  fields: readonly FieldSpec[];
  schema: z.ZodType<Record<string, unknown>>;
};

const text = (min: number, max: number) =>
  z.string().trim().min(min, `Минимум ${min} симв.`).max(max, `Максимум ${max} симв.`);
const isoDate = z.iso.date("Укажите дату");
const isoMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Укажите месяц");

const formats = [
  { value: "electronic", label: "Электронная (PDF с подписью)" },
  { value: "paper", label: "Бумажная, забрать в деканате" },
] as const;

export const requestCatalog = {
  study_certificate: {
    title: "Справка об обучении",
    description: "Подтверждает, что вы студент: для работы, военкомата, визы, соцзащиты.",
    category: "certificate",
    slaDays: 2,
    fields: [
      { name: "destination", label: "Куда предоставить", kind: "text", hint: "Например: по месту работы" },
      { name: "format", label: "Формат", kind: "select", options: formats },
      { name: "copies", label: "Количество экземпляров", kind: "number", hint: "От 1 до 5" },
    ],
    schema: z.object({
      destination: text(2, 200),
      format: z.enum(["electronic", "paper"]),
      copies: z.coerce.number().int().min(1, "Минимум 1").max(5, "Максимум 5"),
    }),
  },
  scholarship_certificate: {
    title: "Справка о размере стипендии",
    description: "Сумма начисленной стипендии за выбранный период.",
    category: "certificate",
    slaDays: 3,
    fields: [
      { name: "periodFrom", label: "С месяца", kind: "month" },
      { name: "periodTo", label: "По месяц", kind: "month" },
      { name: "destination", label: "Куда предоставить", kind: "text" },
      { name: "format", label: "Формат", kind: "select", options: formats },
    ],
    schema: z
      .object({
        periodFrom: isoMonth,
        periodTo: isoMonth,
        destination: text(2, 200),
        format: z.enum(["electronic", "paper"]),
      })
      .refine((v) => v.periodFrom <= v.periodTo, {
        message: "Начало периода позже конца",
        path: ["periodTo"],
      }),
  },
  transcript: {
    title: "Выписка оценок",
    description: "Все оценки за завершённые семестры — для обмена, стажировки, магистратуры.",
    category: "certificate",
    slaDays: 5,
    fields: [
      {
        name: "language",
        label: "Язык",
        kind: "select",
        options: [
          { value: "ru", label: "Русский" },
          { value: "en", label: "Английский" },
        ],
      },
      { name: "purpose", label: "Для чего", kind: "text", hint: "Например: программа обмена" },
    ],
    schema: z.object({
      language: z.enum(["ru", "en"]),
      purpose: text(2, 200),
    }),
  },
  individual_schedule: {
    title: "Индивидуальный график",
    description: "Заявление на свободное посещение на период стажировки, работы или по здоровью.",
    category: "application",
    slaDays: 7,
    fields: [
      {
        name: "reason",
        label: "Причина",
        kind: "select",
        options: [
          { value: "internship", label: "Стажировка" },
          { value: "work", label: "Работа по специальности" },
          { value: "health", label: "Состояние здоровья" },
          { value: "family", label: "Семейные обстоятельства" },
          { value: "other", label: "Другое" },
        ],
      },
      { name: "dateFrom", label: "С даты", kind: "date" },
      { name: "dateTo", label: "По дату", kind: "date" },
      { name: "details", label: "Подробности", kind: "textarea", hint: "Что важно знать деканату" },
    ],
    schema: z
      .object({
        reason: z.enum(["internship", "work", "health", "family", "other"]),
        dateFrom: isoDate,
        dateTo: isoDate,
        details: text(10, 2000),
      })
      .refine((v) => v.dateFrom <= v.dateTo, { message: "Дата начала позже окончания", path: ["dateTo"] }),
  },
  retake: {
    title: "Пересдача",
    description: "Заявление на пересдачу экзамена или зачёта.",
    category: "application",
    slaDays: 5,
    fields: [
      { name: "discipline", label: "Дисциплина", kind: "text" },
      { name: "reason", label: "Комментарий", kind: "textarea", optional: true },
    ],
    schema: z.object({
      discipline: text(2, 200),
      reason: z.string().trim().max(2000, "Максимум 2000 симв.").optional().default(""),
    }),
  },
  dean_question: {
    title: "Вопрос в деканат",
    description: "Если не нашли подходящую заявку — напишите, ответ придёт сюда же.",
    category: "question",
    slaDays: 3,
    fields: [
      { name: "subject", label: "Тема", kind: "text" },
      { name: "message", label: "Сообщение", kind: "textarea" },
    ],
    schema: z.object({
      subject: text(3, 150),
      message: text(10, 4000),
    }),
  },
} as const satisfies Record<string, RequestTypeSpec>;

export type RequestType = keyof typeof requestCatalog;

export function isRequestType(value: string): value is RequestType {
  return Object.hasOwn(requestCatalog, value);
}

export function formatRequestNumber(n: number): string {
  return `З-${String(n).padStart(6, "0")}`;
}
