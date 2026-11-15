import type { RequestType } from "@/lib/requests/catalog";

// Справочник «Куда обратиться» (опрос 15.11, docs/research/survey.md): студенты не знают, в какую службу писать
// и с какой темой. Службы, адреса и часы вымышленные (домен .example зарезервирован и писем не принимает).
// Тот же справочник видит помощник: по нему он называет службу, тему письма и связанные заявки.

export type SupportOffice = {
  id: string;
  title: string;
  /** С чем обращаться — словами студента. */
  topics: readonly string[];
  /** Заявки кабинета по теме службы: через них быстрее и виден статус. */
  requests: readonly RequestType[];
  email: string;
  /** Шаблон темы письма: {group} — группа студента, <…> — заполняет сам студент. */
  subject: string;
  where: string;
  hours: string;
  note?: string;
};

export const SUPPORT_OFFICES: readonly SupportOffice[] = [
  {
    id: "dean",
    title: "Деканат",
    topics: ["Учебный план и расписание", "Пересдачи и задолженности", "Справки об обучении", "Академический отпуск, перевод, индивидуальный график"],
    requests: ["dean_question", "study_certificate", "retake", "individual_schedule"],
    email: "dekanat@university.example",
    subject: "<Тема вопроса>, группа {group}",
    where: "Кронверкский, 49, ауд. 1117",
    hours: "по будням с 10 до 17",
  },
  {
    id: "scholarship",
    title: "Стипендиальный отдел",
    topics: ["Не пришла стипендия или сумма не та", "Повышенная стипендия за достижения", "Социальная стипендия и материальная помощь"],
    requests: ["scholarship_certificate", "achievement_scholarship", "material_aid"],
    email: "stipend@university.example",
    subject: "Стипендия за <месяц>: <что случилось>, группа {group}",
    where: "Кронверкский, 49, 1-й этаж",
    hours: "вт и чт с 11 до 16",
  },
  {
    id: "contract",
    title: "Отдел договорного обучения",
    topics: ["Оплата по договору и квитанции", "Рассрочка и задолженность по оплате", "Документы для налогового вычета"],
    requests: ["tax_deduction"],
    email: "contract@university.example",
    subject: "Договор: <оплата, рассрочка или вычет>, группа {group}",
    where: "Кронверкский, 49, 2-й этаж",
    hours: "по будням с 10 до 16",
  },
  {
    id: "it",
    title: "IT-поддержка",
    topics: ["Wi-Fi, печать, учётная запись", "Техника в аудитории"],
    requests: ["it_support"],
    email: "support@university.example",
    subject: "<Что не работает>: <корпус и аудитория>",
    where: "Заявкой из кабинета",
    hours: "круглосуточно, ответ в рабочее время",
  },
  {
    id: "military",
    title: "Военно-учётный стол",
    topics: ["Отсрочка от призыва", "Постановка на воинский учёт и смена данных", "Повестка во время учёбы"],
    requests: ["military_certificate"],
    email: "vus@university.example",
    subject: "Воинский учёт: <вопрос>, группа {group}",
    where: "Ломоносова, 9, 1-й этаж",
    hours: "пн, ср, пт с 10 до 15",
  },
  {
    id: "international",
    title: "Международный офис",
    topics: ["Программы обмена и двойные дипломы", "Документы на английском для зарубежных вузов", "Визы и регистрация для иностранных студентов"],
    requests: ["transcript", "credit_transfer"],
    email: "international@university.example",
    subject: "Обмен: <программа или вуз>, группа {group}",
    where: "Ломоносова, 9, 3-й этаж",
    hours: "по будням с 10 до 17",
  },
  {
    id: "campus",
    title: "Студенческий городок",
    topics: ["Заселение и переселение в общежитии", "Ремонт и неполадки в комнате", "Оплата общежития"],
    requests: [],
    email: "campus@university.example",
    subject: "Общежитие <номер>, комната <номер>: <вопрос>",
    where: "Комендант в каждом общежитии",
    hours: "по будням с 9 до 18",
  },
  {
    id: "sport",
    title: "Кафедра физического воспитания",
    topics: ["Баллы и зачёт по физкультуре", "Освобождение и специальная медицинская группа"],
    requests: [],
    email: "sport@university.example",
    subject: "Физкультура: <вопрос>, группа {group}",
    where: "Кронверкский, 49, спортзал",
    hours: "по будням с 9 до 19",
    note: "Запись на тренировки и баллы — в разделе «Спорт».",
  },
  {
    id: "care",
    title: "Психологическая служба",
    topics: ["Стресс и тревога перед сессией", "Выгорание, трудно учиться", "Конфликты в группе или с преподавателем"],
    requests: [],
    email: "care@university.example",
    subject: "Запись на консультацию",
    where: "Кронверкский, 49, 4-й этаж",
    hours: "по будням с 10 до 19",
    note: "Бесплатно и конфиденциально: содержание разговора не передаётся деканату.",
  },
  {
    id: "library",
    title: "Библиотека",
    topics: ["Учебники и литература к курсовой", "Доступ к научным базам", "Проверка на заимствования"],
    requests: [],
    email: "library@university.example",
    subject: "<Вопрос>, группа {group}",
    where: "Ломоносова, 9, 2-й этаж",
    hours: "по будням с 9 до 20, сб с 10 до 17",
  },
];

/** Тема письма с группой студента; заглушки <…> остаются студенту. */
export const officeSubject = (office: SupportOffice, group: string) => office.subject.replaceAll("{group}", group);

export const officeHref = (office: SupportOffice) => `/services/support#${office.id}`;

export function mailtoHref(office: SupportOffice, group: string) {
  return `mailto:${office.email}?subject=${encodeURIComponent(officeSubject(office, group))}`;
}
