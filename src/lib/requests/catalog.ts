import { z } from "zod";
import { plural } from "@/lib/format";
import { addDays, mskDayKey } from "@/lib/format";

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

/** Разделы каталога: порядок и подписи — в src/components/request-groups.ts. */
export type RequestCategory = "certificate" | "application" | "status" | "money" | "campus" | "question";

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
  z.string().trim().min(min, `Минимум ${min} ${plural(min, "символ", "символа", "символов")}`).max(max, `Максимум ${max} символов`);
const isoDate = z.iso.date("Укажите дату");
const isoMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Укажите месяц");

// В прототипе документ не выдаётся: меняется только статус заявки (аудит вымышленности NursuUwU, 11.11).
// Исключение — справка об обучении: электронный PDF с QR-проверкой (docs/plans/certificates.md).
const formats = [
  { value: "electronic", label: "Электронная (PDF, в демо не выдаётся)" },
  { value: "paper", label: "Бумажная, забрать в деканате" },
] as const;
const studyFormats = [
  { value: "electronic", label: "Электронная: PDF с QR-кодом проверки" },
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
      { name: "format", label: "Формат", kind: "select", options: studyFormats },
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
      { name: "periodFrom", label: "С какого месяца", kind: "month" },
      { name: "periodTo", label: "По какой месяц", kind: "month" },
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
      { name: "dateFrom", label: "Дата начала", kind: "date" },
      { name: "dateTo", label: "Дата окончания", kind: "date" },
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
      reason: z.string().trim().max(2000, "Максимум 2000 символов").optional().default(""),
    }),
  },
  military_certificate: {
    title: "Справка для военкомата",
    description: "Для постановки на воинский учёт и отсрочки на время обучения.",
    category: "certificate",
    slaDays: 3,
    fields: [
      { name: "office", label: "Военный комиссариат", kind: "text", hint: "Например: Петроградского района" },
      { name: "format", label: "Формат", kind: "select", options: formats },
    ],
    schema: z.object({
      office: text(3, 200),
      format: z.enum(["electronic", "paper"]),
    }),
  },
  employer_call: {
    title: "Справка-вызов на сессию",
    description: "Для работодателя: учебный отпуск на время сессии.",
    category: "certificate",
    slaDays: 3,
    fields: [
      { name: "employer", label: "Организация", kind: "text", hint: "Где вы работаете" },
      { name: "dateFrom", label: "Начало сессии", kind: "date" },
      { name: "dateTo", label: "Конец сессии", kind: "date" },
      { name: "format", label: "Формат", kind: "select", options: formats },
    ],
    schema: z
      .object({
        employer: text(2, 200),
        dateFrom: isoDate,
        dateTo: isoDate,
        format: z.enum(["electronic", "paper"]),
      })
      .refine((v) => v.dateFrom <= v.dateTo, { message: "Дата начала позже окончания", path: ["dateTo"] }),
  },
  tax_deduction: {
    title: "Справка для налогового вычета",
    description: "Для тех, кто учится по договору: подтверждает оплату обучения за год.",
    category: "certificate",
    slaDays: 5,
    fields: [
      {
        name: "year",
        label: "За какой год",
        kind: "select",
        options: [
          { value: "2024", label: "2024" },
          { value: "2025", label: "2025" },
          { value: "2026", label: "2026" },
        ],
      },
      { name: "payer", label: "Кто платил", kind: "text", hint: "ФИО налогоплательщика: вы или родитель" },
      { name: "format", label: "Формат", kind: "select", options: formats },
    ],
    schema: z.object({
      year: z.enum(["2024", "2025", "2026"]),
      payer: text(5, 150),
      format: z.enum(["electronic", "paper"]),
    }),
  },
  credit_transfer: {
    title: "Перезачёт дисциплины",
    description: "Зачесть курс, пройденный в другом вузе, по обмену или онлайн.",
    category: "application",
    slaDays: 10,
    fields: [
      { name: "discipline", label: "Дисциплина в учебном плане", kind: "text" },
      { name: "source", label: "Где изучали", kind: "text", hint: "Вуз, программа обмена или онлайн-курс" },
      { name: "credits", label: "Зачётных единиц", kind: "number", hint: "Как в документе об изучении, от 1 до 30" },
      { name: "details", label: "Комментарий", kind: "textarea", optional: true },
    ],
    schema: z.object({
      discipline: text(2, 200),
      source: text(2, 200),
      credits: z.coerce.number().int().min(1, "Минимум 1").max(30, "Максимум 30"),
      details: z.string().trim().max(2000, "Максимум 2000 символов").optional().default(""),
    }),
  },
  course_topic: {
    title: "Тема курсовой работы",
    description: "Закрепить тему и научного руководителя.",
    category: "application",
    slaDays: 5,
    fields: [
      { name: "discipline", label: "Дисциплина", kind: "text" },
      { name: "topic", label: "Тема", kind: "text" },
      { name: "supervisor", label: "Научный руководитель", kind: "text", hint: "ФИО преподавателя" },
    ],
    schema: z.object({
      discipline: text(2, 200),
      topic: text(5, 300),
      supervisor: text(5, 150),
    }),
  },
  academic_leave: {
    title: "Академический отпуск",
    description: "Перерыв в учёбе с сохранением места: по здоровью, семейным и другим причинам.",
    category: "status",
    slaDays: 10,
    fields: [
      {
        name: "reason",
        label: "Причина",
        kind: "select",
        options: [
          { value: "health", label: "Состояние здоровья" },
          { value: "family", label: "Семейные обстоятельства" },
          { value: "military", label: "Военная служба" },
          { value: "other", label: "Другое" },
        ],
      },
      { name: "dateFrom", label: "Дата начала", kind: "date" },
      {
        name: "duration",
        label: "Срок",
        kind: "select",
        options: [
          { value: "6m", label: "Полгода" },
          { value: "1y", label: "Год" },
          { value: "2y", label: "Два года" },
        ],
      },
      { name: "details", label: "Подробности", kind: "textarea", hint: "Документы деканат попросит отдельно" },
    ],
    schema: z.object({
      reason: z.enum(["health", "family", "military", "other"]),
      dateFrom: isoDate,
      duration: z.enum(["6m", "1y", "2y"]),
      details: text(10, 2000),
    }),
  },
  transfer: {
    title: "Перевод",
    description: "На другую программу, форму обучения или с договора на бюджет.",
    category: "status",
    slaDays: 14,
    fields: [
      {
        name: "kind",
        label: "Что меняется",
        kind: "select",
        options: [
          { value: "program", label: "Направление или профиль" },
          { value: "form", label: "Форма обучения" },
          { value: "funding", label: "С договора на бюджет" },
        ],
      },
      { name: "target", label: "Куда хотите перейти", kind: "text", hint: "Например: очно-заочная форма" },
      { name: "reason", label: "Почему", kind: "textarea" },
    ],
    schema: z.object({
      kind: z.enum(["program", "form", "funding"]),
      target: text(2, 200),
      reason: text(10, 2000),
    }),
  },
  document_duplicate: {
    title: "Дубликат студенческого билета или зачётной книжки",
    description: "Если документ потерян, испорчен или сменилась фамилия.",
    category: "status",
    slaDays: 5,
    fields: [
      {
        name: "document",
        label: "Документ",
        kind: "select",
        options: [
          { value: "student_card", label: "Студенческий билет" },
          { value: "record_book", label: "Зачётная книжка" },
        ],
      },
      {
        name: "reason",
        label: "Причина",
        kind: "select",
        options: [
          { value: "lost", label: "Потерян" },
          { value: "damaged", label: "Испорчен" },
          { value: "name_change", label: "Смена фамилии" },
        ],
      },
      { name: "details", label: "Комментарий", kind: "textarea", optional: true },
    ],
    schema: z.object({
      document: z.enum(["student_card", "record_book"]),
      reason: z.enum(["lost", "damaged", "name_change"]),
      details: z.string().trim().max(2000, "Максимум 2000 символов").optional().default(""),
    }),
  },
  material_aid: {
    title: "Материальная помощь",
    description: "Разовая выплата в трудной ситуации. Решение принимает стипендиальная комиссия.",
    category: "money",
    slaDays: 10,
    fields: [
      {
        name: "reason",
        label: "Ситуация",
        kind: "select",
        options: [
          { value: "health", label: "Лечение" },
          { value: "family", label: "Семейные обстоятельства" },
          { value: "emergency", label: "Чрезвычайная ситуация" },
          { value: "other", label: "Другое" },
        ],
      },
      { name: "details", label: "Что случилось", kind: "textarea", hint: "Подтверждающие документы деканат попросит отдельно" },
    ],
    schema: z.object({
      reason: z.enum(["health", "family", "emergency", "other"]),
      details: text(10, 2000),
    }),
  },
  achievement_scholarship: {
    title: "Повышенная стипендия",
    description: "За достижения в учёбе, науке, общественной жизни, спорте или творчестве.",
    category: "money",
    slaDays: 14,
    fields: [
      {
        name: "area",
        label: "Направление",
        kind: "select",
        options: [
          { value: "study", label: "Учёба" },
          { value: "science", label: "Наука" },
          { value: "social", label: "Общественная деятельность" },
          { value: "sport", label: "Спорт" },
          { value: "culture", label: "Творчество" },
        ],
      },
      { name: "achievements", label: "Достижения", kind: "textarea", hint: "Что, когда и где: статьи, олимпиады, проекты" },
    ],
    schema: z.object({
      area: z.enum(["study", "science", "social", "sport", "culture"]),
      achievements: text(20, 4000),
    }),
  },
  it_support: {
    title: "Проблема с Wi-Fi, печатью или аккаунтом",
    description: "Заявка в IT-поддержку: не подключается, не печатает, не входит.",
    category: "campus",
    slaDays: 2,
    fields: [
      {
        name: "topic",
        label: "Что не работает",
        kind: "select",
        options: [
          { value: "wifi", label: "Wi-Fi" },
          { value: "print", label: "Печать" },
          { value: "account", label: "Учётная запись" },
          { value: "classroom", label: "Техника в аудитории" },
          { value: "other", label: "Другое" },
        ],
      },
      { name: "place", label: "Где", kind: "text", optional: true, hint: "Корпус и аудитория, если важно" },
      { name: "details", label: "Что случилось", kind: "textarea", hint: "Что делали и что увидели: текст ошибки, устройство" },
    ],
    schema: z.object({
      topic: z.enum(["wifi", "print", "account", "classroom", "other"]),
      place: z.string().trim().max(200, "Максимум 200 символов").optional().default(""),
      details: text(10, 2000),
    }),
  },
  guest_pass: {
    title: "Гостевой пропуск",
    description: "Провести гостя в корпус: на защиту, мероприятие, встречу.",
    category: "campus",
    slaDays: 1,
    fields: [
      { name: "guest", label: "ФИО гостя", kind: "text" },
      { name: "date", label: "Дата визита", kind: "date", hint: "В ближайшие 30 дней" },
      {
        name: "building",
        label: "Корпус",
        kind: "select",
        options: [
          { value: "kronv", label: "Кронверкский, 49" },
          { value: "lom-m", label: "Ломоносова, 9" },
        ],
      },
      { name: "purpose", label: "Цель визита", kind: "text" },
    ],
    schema: z
      .object({
        guest: text(5, 150),
        date: isoDate,
        building: z.enum(["kronv", "lom-m"]),
        purpose: text(3, 200),
      })
      // Срок считается по московскому времени на момент проверки: вчерашний пропуск не заказать.
      .refine((v) => v.date >= mskDayKey(new Date()) && v.date <= mskDayKey(addDays(new Date(), 30)), {
        message: "Дата — с сегодняшнего дня и не дальше 30 дней",
        path: ["date"],
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
