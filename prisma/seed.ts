// Демонстрационные данные University. ВСЕ ЛЮДИ, БАЛЛЫ И НОМЕРА ВЫМЫШЛЕНЫ.
// Адреса и координаты корпусов — открытые данные (см. docs/ai-log/codex/05-concept-itmo.md);
// координаты литер Ломоносова, 9 — приблизительные.
// Запуск: `npm run db:seed`. Seed ПОЛНОСТЬЮ пересоздаёт данные (демо-сброс).
// Оценки ставятся только за точки, срок которых прошёл к моменту запуска, — поэтому перед
// показом жюри seed запускают заново, и картина «как у меня дела» остаётся живой.
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import type { Prisma } from "../src/generated/prisma/client";
import { requestCatalog, type RequestType } from "../src/lib/requests/catalog";
import { checkSlot, type BusyItem } from "../src/lib/sport/availability";
import { baseAuthOptions } from "../src/server/auth-options";
import { prisma } from "../src/server/db";

if (existsSync(".env")) process.loadEnvFile(".env");

if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_RESET !== "1") {
  console.error("Seed стирает все данные. В production запустите с SEED_ALLOW_RESET=1.");
  process.exit(1);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.length < 8) {
    console.error(`Задайте ${name} (не короче 8 символов) в .env — пароль тестового аккаунта.`);
    process.exit(1);
  }
  return value;
}

// Отдельный экземпляр Better Auth только для seed: здесь регистрация разрешена,
// в веб-приложении (src/server/auth.ts) — запрещена. Пароли хеширует Better Auth.
const seedAuth = betterAuth({
  ...baseAuthOptions,
  emailAndPassword: { enabled: true, autoSignIn: false },
  plugins: [username()],
});

const NOW = new Date();

// ─── Время ──────────────────────────────────────────────────────────────────
// Санкт-Петербург, как и Москва, — UTC+3 круглый год.
const msk = (date: string, time = "00:00") => new Date(`${date}T${time}:00+03:00`);
const day = (date: string) => new Date(`${date}T00:00:00Z`); // для полей @db.Date
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const isoDay = (d: Date) => new Date(d.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);
const weekdayOf = (date: string) => ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1; // 1 — пн

// Сетка пар University (демо, по мотивам расписания ИТМО).
const SLOTS = [
  ["08:10", "09:40"],
  ["09:50", "11:20"],
  ["11:30", "13:00"],
  ["13:30", "15:00"],
  ["15:20", "16:50"],
  ["17:00", "18:30"],
  ["18:40", "20:10"],
] as const;

const TERM = { start: "2026-09-01", end: "2026-12-27", sessionStart: "2026-12-28", sessionEnd: "2027-01-31" };
const HOLIDAYS = new Set(["2026-11-04"]); // День народного единства

// ─── Справочники ────────────────────────────────────────────────────────────
const BUILDINGS = [
  { id: "kronv", title: "Кронверкский, 49", address: "Кронверкский пр., 49", lat: 59.95636, lon: 30.31001, metro: "Горьковская" },
  { id: "lom-a", title: "Ломоносова, 9, лит. А", address: "ул. Ломоносова, 9, лит. А", lat: 59.92716, lon: 30.33808, metro: "Достоевская" },
  { id: "lom-b", title: "Ломоносова, 9, лит. Б", address: "ул. Ломоносова, 9, лит. Б", lat: 59.92742, lon: 30.33872, metro: "Достоевская" },
  { id: "lom-e", title: "Ломоносова, 9, лит. Е", address: "ул. Ломоносова, 9, лит. Е", lat: 59.92705, lon: 30.33861, metro: "Достоевская" },
  { id: "lom-m", title: "Ломоносова, 9, лит. М", address: "ул. Ломоносова, 9, лит. М", lat: 59.92729, lon: 30.33835, metro: "Достоевская" },
  { id: "birzh", title: "Биржевая линия, 14", address: "Биржевая линия, 14", lat: 59.94413, lon: 30.29545, metro: "Спортивная" },
  { id: "grivc", title: "Гривцова, 14", address: "пер. Гривцова, 14–16", lat: 59.92953, lon: 30.31506, metro: "Садовая" },
  { id: "chaik", title: "Чайковского, 11/2", address: "ул. Чайковского, 11/2", lat: 59.94636, lon: 30.3458, metro: "Чернышевская" },
  { id: "sport", title: "Спорткомплекс, Вяземский пер.", address: "Вяземский пер., 5–7", lat: 59.97263, lon: 30.3025, metro: "Петроградская" },
] as const;
type BuildingId = (typeof BUILDINGS)[number]["id"];

const FACULTIES = [
  { code: "CHB", title: "Факультет химии и биотехнологий", shortName: "ФХБ" },
  { code: "SE", title: "Факультет программной инженерии и компьютерной техники", shortName: "ФПИиКТ" },
];

const TEACHERS = {
  belyaev: ["Беляев Олег Викторович", "профессор"],
  zorina: ["Зорина Марина Сергеевна", "доцент"],
  kalinin: ["Калинин Игорь Дмитриевич", "доцент"],
  harris: ["Харрис Елена Джоновна", "старший преподаватель"],
  sadykov: ["Садыков Ренат Ильдарович", "доцент"],
  vetrova: ["Ветрова Анна Константиновна", "доцент"],
  gromov: ["Громов Павел Алексеевич", "профессор"],
  shults: ["Шульц Ирина Викторовна", "старший преподаватель"],
  nazarov: ["Назаров Денис Олегович", "доцент"],
  frolova: ["Фролова Яна Михайловна", "доцент"],
  osipov: ["Осипов Глеб Андреевич", "ассистент"],
  lemoine: ["Лемуан Софи-Анна Петровна", "старший преподаватель"],
} as const;
type TeacherKey = keyof typeof TEACHERS;

type Control = "EXAM" | "CREDIT" | "GRADED_CREDIT";

type OfferingSeed = {
  key: string;
  title: string;
  short?: string;
  control: Control;
  credits: number;
  teacher: TeacherKey;
  /** Доля от максимума, которую студент набирает за оценённые точки (0..1). */
  level: number;
};

type WeeklySlot = {
  offering: string;
  weekday: 1 | 2 | 3 | 4 | 5 | 6;
  slot: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  kind: "LECTURE" | "SEMINAR" | "LANGUAGE" | "PRACTICE";
  building?: BuildingId; // нет — онлайн
  room?: string;
  teacher?: TeacherKey;
};

type PreviousSeed = { title: string; control: Control; credits: number; teacher: TeacherKey; attempts: number[] };

type StudentSeed = {
  login: string;
  passwordEnv: string;
  name: string;
  recordBook: string;
  funding: string;
  enrolledAt: string;
  group: { code: string; faculty: string; program: string; profile: string; course: number };
  current: OfferingSeed[];
  weekly: WeeklySlot[];
  previousTitle: string;
  previous: PreviousSeed[];
};

const STUDENTS: StudentSeed[] = [
  {
    login: "alina.lebedeva",
    passwordEnv: "SEED_PASSWORD_STUDENT_A",
    name: "Лебедева Алина Игоревна",
    recordBook: "424117",
    funding: "бюджет",
    enrolledAt: "2024-09-01",
    group: {
      code: "H3301",
      faculty: "CHB",
      program: "18.03.01 Химическая технология",
      profile: "Инфохимия",
      course: 3,
    },
    current: [
      { key: "org", title: "Органическая химия", control: "EXAM", credits: 6, teacher: "belyaev", level: 0.86 },
      { key: "phys", title: "Физическая химия", control: "EXAM", credits: 5, teacher: "gromov", level: 0.48 },
      { key: "chinf", title: "Хемоинформатика", control: "GRADED_CREDIT", credits: 4, teacher: "nazarov", level: 0.92 },
      { key: "bio", title: "Биохимия", control: "CREDIT", credits: 3, teacher: "vetrova", level: 0.74 },
      { key: "eng", title: "English C1 / Английский язык C1", short: "Английский C1", control: "CREDIT", credits: 2, teacher: "harris", level: 0.81 },
      { key: "phil", title: "Философия", control: "EXAM", credits: 3, teacher: "sadykov", level: 0.67 },
    ],
    weekly: [
      // Пн: всё на Ломоносова, переход между литерами М → А за 10 минут (успеть можно)
      { offering: "org", weekday: 1, slot: 1, kind: "LECTURE", building: "lom-m", room: "ауд. 1121" },
      { offering: "org", weekday: 1, slot: 2, kind: "PRACTICE", building: "lom-m", room: "ауд. 1220", teacher: "osipov" },
      { offering: "phys", weekday: 1, slot: 3, kind: "LECTURE", building: "lom-a", room: "ауд. 2219" },
      // Вт: Ломоносова → Гривцова за 10 минут — не успеть (показываем предупреждение)
      { offering: "eng", weekday: 2, slot: 1, kind: "LANGUAGE", building: "lom-e", room: "ауд. 3228" },
      { offering: "chinf", weekday: 2, slot: 2, kind: "PRACTICE", building: "grivc", room: "ауд. 466" },
      { offering: "chinf", weekday: 2, slot: 3, kind: "LECTURE", building: "grivc", room: "ауд. 466" },
      // Ср: Ломоносова → Кронверкский за большой перерыв — только на транспорте, впритык
      { offering: "phys", weekday: 3, slot: 2, kind: "PRACTICE", building: "lom-m", room: "ауд. 1329" },
      { offering: "phys", weekday: 3, slot: 3, kind: "PRACTICE", building: "lom-m", room: "ауд. 1329" },
      { offering: "phil", weekday: 3, slot: 4, kind: "LECTURE", building: "kronv", room: "ауд. 2337" },
      // Чт: свободный день — онлайн-семинар по философии
      { offering: "phil", weekday: 4, slot: 5, kind: "SEMINAR" },
      // Пт
      { offering: "bio", weekday: 5, slot: 3, kind: "LECTURE", building: "lom-m", room: "ауд. 1221" },
      { offering: "org", weekday: 5, slot: 4, kind: "LECTURE", building: "lom-m", room: "ауд. 1121" },
      { offering: "eng", weekday: 5, slot: 5, kind: "LANGUAGE", building: "lom-b", room: "ауд. 4302" },
    ],
    previousTitle: "Весенний семестр 2025/26",
    previous: [
      { title: "Аналитическая химия", control: "EXAM", credits: 5, teacher: "belyaev", attempts: [88] },
      { title: "Неорганическая химия", control: "EXAM", credits: 5, teacher: "zorina", attempts: [79] },
      { title: "Основы программирования и алгоритмизации", control: "GRADED_CREDIT", credits: 3, teacher: "nazarov", attempts: [95] },
      { title: "Физика", control: "EXAM", credits: 4, teacher: "gromov", attempts: [71] },
      { title: "English B2 / Английский язык B2", control: "CREDIT", credits: 2, teacher: "harris", attempts: [86] },
      { title: "История России", control: "CREDIT", credits: 2, teacher: "kalinin", attempts: [77] },
    ],
  },
  {
    login: "timur.orlov",
    passwordEnv: "SEED_PASSWORD_STUDENT_B",
    name: "Орлов Тимур Русланович",
    recordBook: "451932",
    funding: "договор",
    enrolledAt: "2025-09-01",
    group: {
      code: "P3212",
      faculty: "SE",
      program: "09.03.04 Программная инженерия",
      profile: "Системное и прикладное программное обеспечение",
      course: 2,
    },
    current: [
      { key: "algo", title: "Алгоритмы и структуры данных", short: "АиСД", control: "EXAM", credits: 6, teacher: "nazarov", level: 0.78 },
      { key: "db", title: "Базы данных", control: "EXAM", credits: 5, teacher: "frolova", level: 0.9 },
      { key: "java", title: "Программирование на Java", short: "Java", control: "GRADED_CREDIT", credits: 4, teacher: "kalinin", level: 0.95 },
      { key: "dm", title: "Дискретная математика", short: "Дискретка", control: "EXAM", credits: 4, teacher: "zorina", level: 0.42 },
      { key: "eng", title: "English B2 / Английский язык B2", short: "Английский B2", control: "CREDIT", credits: 2, teacher: "shults", level: 0.7 },
      { key: "hist", title: "История России", control: "CREDIT", credits: 2, teacher: "sadykov", level: 0.83 },
    ],
    weekly: [
      { offering: "algo", weekday: 1, slot: 2, kind: "LECTURE", building: "kronv", room: "ауд. 1404" },
      { offering: "algo", weekday: 1, slot: 3, kind: "PRACTICE", building: "kronv", room: "ауд. 2306" },
      { offering: "dm", weekday: 2, slot: 1, kind: "LECTURE", building: "kronv", room: "ауд. 1216" },
      { offering: "dm", weekday: 2, slot: 2, kind: "PRACTICE", building: "kronv", room: "ауд. 1216", teacher: "osipov" },
      // Вт: Кронверкский → Биржевая за 10 минут — не успеть
      { offering: "eng", weekday: 2, slot: 3, kind: "LANGUAGE", building: "birzh", room: "ауд. 312" },
      { offering: "db", weekday: 3, slot: 3, kind: "LECTURE", building: "kronv", room: "ауд. 1404" },
      // Ср: обед 30 минут, Кронверкский → Биржевая пешком
      { offering: "db", weekday: 3, slot: 4, kind: "PRACTICE", building: "birzh", room: "ауд. 210" },
      { offering: "java", weekday: 4, slot: 4, kind: "LECTURE", building: "kronv", room: "ауд. 2337" },
      { offering: "java", weekday: 4, slot: 5, kind: "PRACTICE", building: "kronv", room: "ауд. 3214" },
      // Пт: история онлайн
      { offering: "hist", weekday: 5, slot: 2, kind: "LECTURE" },
      { offering: "eng", weekday: 5, slot: 3, kind: "LANGUAGE", building: "kronv", room: "ауд. 1132" },
    ],
    previousTitle: "Весенний семестр 2025/26",
    previous: [
      { title: "Математический анализ", control: "EXAM", credits: 5, teacher: "zorina", attempts: [52, 68] },
      { title: "Программирование", control: "EXAM", credits: 5, teacher: "kalinin", attempts: [92] },
      { title: "Основы профессиональной деятельности", control: "GRADED_CREDIT", credits: 4, teacher: "nazarov", attempts: [84] },
      { title: "Линейная алгебра", control: "EXAM", credits: 4, teacher: "gromov", attempts: [75] },
      { title: "English B1 / Английский язык B1", control: "CREDIT", credits: 2, teacher: "shults", attempts: [80] },
      { title: "Физическая культура и спорт", control: "CREDIT", credits: 0, teacher: "osipov", attempts: [65] },
    ],
  },
];

const STAFF = {
  login: "dekanat.fhb",
  passwordEnv: "SEED_PASSWORD_STAFF",
  name: "Миронова Ксения Павловна",
  position: "Специалист по учебной работе деканата ФХБ",
  faculty: "CHB",
};

// ─── Контрольные точки (сумма = 100) ────────────────────────────────────────
type CheckpointSeed = { title: string; kind: "MIDTERM" | "ASSIGNMENT"; max: number; due: string };

function checkpointsFor(control: Control, i: number): CheckpointSeed[] {
  const shift = (date: string) => isoDay(addDays(msk(date), i)); // разносим сроки между дисциплинами
  if (control === "EXAM") {
    return [
      { title: "Лабораторная работа 1", kind: "ASSIGNMENT", max: 10, due: shift("2026-09-29") },
      { title: "Лабораторная работа 2", kind: "ASSIGNMENT", max: 10, due: shift("2026-10-20") },
      { title: "Контрольная работа", kind: "MIDTERM", max: 20, due: shift("2026-10-30") },
      { title: "Лабораторная работа 3", kind: "ASSIGNMENT", max: 10, due: shift("2026-11-17") },
      { title: "Лабораторная работа 4", kind: "ASSIGNMENT", max: 10, due: shift("2026-12-08") },
    ]; // + экзамен 40
  }
  return [
    { title: "Тест 1", kind: "MIDTERM", max: 20, due: shift("2026-10-06") },
    { title: "Тест 2", kind: "MIDTERM", max: 20, due: shift("2026-11-03") },
    { title: control === "GRADED_CREDIT" ? "Проект" : "Доклад", kind: "ASSIGNMENT", max: 40, due: shift("2026-12-01") },
  ]; // + зачёт 20
}
const finalMax = (control: Control) => (control === "EXAM" ? 40 : 20);
const finalTitle = (control: Control) =>
  control === "EXAM" ? "Экзамен" : control === "CREDIT" ? "Зачёт" : "Дифференцированный зачёт";

// Детерминированный «шум», чтобы баллы не были одинаковыми.
const jitter = (seed: number) => ((Math.sin(seed * 9301 + 49297) + 1) / 2) * 0.24 - 0.12;
const roundHalf = (n: number) => Math.round(n * 2) / 2;
const gradeFor = (p: number) => (p >= 91 ? 5 : p >= 75 ? 4 : p >= 60 ? 3 : 2);

// ─── Утилиты ────────────────────────────────────────────────────────────────
async function createUser(login: string, name: string, password: string) {
  const { user } = await seedAuth.api.signUpEmail({
    body: { email: `${login}@demo.university.example`, name, password, username: login },
  });
  return user.id;
}

function payloadFor(type: RequestType, input: Record<string, unknown>) {
  // Seed проходит через ту же валидацию, что и форма студента.
  return requestCatalog[type].schema.parse(input) as Prisma.InputJsonObject;
}

async function wipe() {
  // Порядок важен из-за внешних ключей.
  await prisma.sportBooking.deleteMany();
  await prisma.sportPreference.deleteMany();
  await prisma.sportExtraPoints.deleteMany();
  await prisma.sportSlot.deleteMany();
  await prisma.sportSection.deleteMany();
  await prisma.sportWeek.deleteMany();
  await prisma.notificationRecipient.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.requestEvent.deleteMany();
  await prisma.request.deleteMany();
  await prisma.gradeResult.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.lessonChange.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.courseOffering.deleteMany();
  await prisma.discipline.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.building.deleteMany();
  await prisma.academicTerm.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.staffProfile.deleteMany();
  await prisma.studyGroup.deleteMany();
  await prisma.faculty.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.rateLimit.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE "request_number_seq" RESTART WITH 1024`);
}

// ─── Основной сценарий ──────────────────────────────────────────────────────
async function main() {
  const passwords = {
    ...Object.fromEntries(STUDENTS.map((s) => [s.login, requireEnv(s.passwordEnv)])),
    [STAFF.login]: requireEnv(STAFF.passwordEnv),
  };

  await wipe();

  await prisma.faculty.createMany({ data: FACULTIES });
  await prisma.building.createMany({ data: BUILDINGS.map((b) => ({ ...b })) });

  const teacherIds = {} as Record<TeacherKey, string>;
  for (const [key, [fullName, position]] of Object.entries(TEACHERS)) {
    const t = await prisma.teacher.create({ data: { fullName, position } });
    teacherIds[key as TeacherKey] = t.id;
  }

  const prevTerm = await prisma.academicTerm.create({
    data: {
      title: "Весенний семестр 2025/26",
      startsOn: day("2026-02-02"),
      endsOn: day("2026-05-31"),
      sessionStartsOn: day("2026-06-01"),
      sessionEndsOn: day("2026-06-30"),
    },
  });
  const term = await prisma.academicTerm.create({
    data: {
      title: "Осенний семестр 2026/27",
      startsOn: day(TERM.start),
      endsOn: day(TERM.end),
      sessionStartsOn: day(TERM.sessionStart),
      sessionEndsOn: day(TERM.sessionEnd),
    },
  });

  const staffUserId = await createUser(STAFF.login, STAFF.name, passwords[STAFF.login]);
  await prisma.user.update({ where: { id: staffUserId }, data: { role: "staff" } });
  await prisma.staffProfile.create({
    data: { userId: staffUserId, position: STAFF.position, facultyCode: STAFF.faculty },
  });

  for (const s of STUDENTS) {
    await seedStudent(s, passwords[s.login], { term: term.id, prevTerm: prevTerm.id }, teacherIds, staffUserId);
  }

  await seedAnnouncements();
  await seedSport(term.id);
  await seedClassmate(STUDENTS[0].group.code);

  const counts = {
    users: await prisma.user.count(),
    buildings: await prisma.building.count(),
    lessons: await prisma.lesson.count(),
    changes: await prisma.lessonChange.count(),
    results: await prisma.gradeResult.count(),
    requests: await prisma.request.count(),
    notifications: await prisma.notification.count(),
    sportSlots: await prisma.sportSlot.count(),
    sportBookings: await prisma.sportBooking.count(),
    sportPreferences: await prisma.sportPreference.count(),
  };
  console.log("Seed готов:", counts);
  console.log("Логины:", [...STUDENTS.map((s) => s.login), STAFF.login].join(", "), "— пароли в .env");
}

async function seedStudent(
  s: StudentSeed,
  password: string,
  terms: { term: string; prevTerm: string },
  teacherIds: Record<TeacherKey, string>,
  staffUserId: string,
) {
  const group = await prisma.studyGroup.create({
    data: {
      code: s.group.code,
      facultyCode: s.group.faculty,
      program: s.group.program,
      profile: s.group.profile,
      course: s.group.course,
    },
  });
  const userId = await createUser(s.login, s.name, password);
  const student = await prisma.studentProfile.create({
    data: {
      userId,
      groupId: group.id,
      recordBookNumber: s.recordBook,
      funding: s.funding,
      enrolledAt: day(s.enrolledAt),
    },
  });

  // Дисциплины текущего семестра
  const offerings: Record<string, { id: string; title: string }> = {};
  for (const o of s.current) {
    const discipline = await prisma.discipline.create({ data: { title: o.title, shortTitle: o.short } });
    const offering = await prisma.courseOffering.create({
      data: {
        disciplineId: discipline.id,
        groupId: group.id,
        termId: terms.term,
        leadTeacherId: teacherIds[o.teacher],
        controlForm: o.control,
        credits: o.credits,
      },
    });
    offerings[o.key] = { id: offering.id, title: o.short ?? o.title };
  }

  // Расписание на весь семестр по недельному шаблону
  const lessons: Prisma.LessonCreateManyInput[] = [];
  for (let d = msk(TERM.start); d <= msk(TERM.end); d = addDays(d, 1)) {
    const date = isoDay(d);
    if (HOLIDAYS.has(date)) continue;
    for (const w of s.weekly.filter((x) => x.weekday === weekdayOf(date))) {
      const [from, to] = SLOTS[w.slot - 1];
      lessons.push({
        offeringId: offerings[w.offering].id,
        kind: w.kind,
        startsAt: msk(date, from),
        endsAt: msk(date, to),
        buildingId: w.building ?? null,
        room: w.room ?? null,
        online: !w.building,
        teacherId: w.teacher ? teacherIds[w.teacher] : null,
      });
    }
  }
  await prisma.lesson.createMany({ data: lessons });

  await seedScheduleChanges(s, group.id, userId);

  // Успеваемость текущего семестра: контрольные точки + аттестация.
  for (const [i, o] of s.current.entries()) {
    const offeringId = offerings[o.key].id;
    for (const [j, cp] of checkpointsFor(o.control, i).entries()) {
      const dueAt = msk(cp.due, "23:59");
      const a = await prisma.assessment.create({
        data: {
          offeringId,
          kind: cp.kind,
          title: cp.title,
          maxPoints: cp.max,
          ...(cp.kind === "MIDTERM" ? { scheduledAt: msk(cp.due, "11:30") } : { dueAt }),
        },
      });
      // Оценено, если срок прошёл больше двух дней назад.
      if (addDays(dueAt, 2) < NOW) {
        const ratio = Math.min(1, Math.max(0, o.level + jitter(i * 10 + j + s.login.length)));
        await prisma.gradeResult.create({
          data: {
            studentId: student.id,
            assessmentId: a.id,
            points: roundHalf(cp.max * ratio),
            gradedAt: addDays(dueAt, 2),
          },
        });
      } else if (dueAt > NOW) {
        await prisma.notification.create({
          data: {
            kind: "DEADLINE",
            title: `Срок через неделю: ${cp.title.toLowerCase()} — ${offerings[o.key].title}`,
            body: `Сдать до ${isoDay(dueAt).split("-").reverse().join(".")} 23:59. Максимум — ${cp.max} баллов.`,
            publishedAt: addDays(dueAt, -7),
            recipients: { create: { userId } },
          },
        });
      }
    }
    await prisma.assessment.create({
      data: {
        offeringId,
        kind: o.control,
        title: finalTitle(o.control),
        maxPoints: finalMax(o.control),
        scheduledAt: msk(isoDay(addDays(msk("2026-12-28"), i * 4 + (o.control === "EXAM" ? 6 : 0))), "10:00"),
        room: o.control === "EXAM" ? "ауд. 1404" : null,
      },
    });
  }

  // Прошлый семестр: итоговые баллы по шкале (у второго студента — пересдача).
  for (const p of s.previous) {
    const discipline = await prisma.discipline.create({ data: { title: p.title } });
    const offering = await prisma.courseOffering.create({
      data: {
        disciplineId: discipline.id,
        groupId: group.id,
        termId: terms.prevTerm,
        leadTeacherId: teacherIds[p.teacher],
        controlForm: p.control,
        credits: p.credits,
      },
    });
    const final = await prisma.assessment.create({
      data: {
        offeringId: offering.id,
        kind: p.control,
        title: `Итог: ${finalTitle(p.control).toLowerCase()}`,
        maxPoints: 100,
        scheduledAt: msk("2026-06-15", "10:00"),
      },
    });
    for (const [k, points] of p.attempts.entries()) {
      await prisma.gradeResult.create({
        data: {
          studentId: student.id,
          assessmentId: final.id,
          attempt: k + 1,
          points,
          ...(p.control === "CREDIT" ? { passed: points >= 60 } : { grade: gradeFor(points) }),
          comment: k > 0 ? "Пересдача" : null,
          gradedAt: msk(k > 0 ? "2026-09-12" : "2026-06-16", "15:00"),
        },
      });
    }
  }

  await seedRequests(s, student.id, userId, staffUserId);
}

// Одногруппник первого студента без учётной записи (войти нельзя). Нужен тестам доступа:
// у студентов одной группы общие пары и дисциплины, но свои баллы и записи на физкультуру.
async function seedClassmate(groupCode: string) {
  const group = await prisma.studyGroup.findUniqueOrThrow({ where: { code: groupCode } });
  const user = await prisma.user.create({
    data: {
      id: randomUUID(),
      name: "Одногруппник (демо, без входа)",
      email: "classmate@demo.university.example",
      username: "demo.classmate",
      role: "student",
    },
  });
  const student = await prisma.studentProfile.create({
    data: { userId: user.id, groupId: group.id, recordBookNumber: "DEMO0001", funding: "бюджет", enrolledAt: day("2024-09-01") },
  });
  const graded = await prisma.assessment.findMany({
    where: { offering: { groupId: group.id }, results: { some: {} } },
    select: { id: true, maxPoints: true },
  });
  await prisma.gradeResult.createMany({
    data: graded.map((a, i) => ({
      studentId: student.id,
      assessmentId: a.id,
      points: roundHalf((a.maxPoints ?? 0) * (0.35 + (i % 3) * 0.1)),
      gradedAt: NOW,
    })),
  });
  const slot = await prisma.sportSlot.findFirst({ where: { startsAt: { gt: NOW } }, orderBy: { startsAt: "asc" } });
  if (slot) {
    await prisma.sportBooking.create({
      data: { studentId: student.id, slotId: slot.id, weekStart: slot.weekStart, status: "CONFIRMED", rank: 1 },
    });
  }
}

// Переносы: одно изменение в неделю, с октября по декабрь, чтобы в любой день показа
// рядом было свежее. Часть переносов — в другой корпус (меняется маршрут).
async function seedScheduleChanges(s: StudentSeed, groupId: string, userId: string) {
  const all = await prisma.lesson.findMany({
    where: { offering: { groupId }, startsAt: { gte: msk("2026-10-01"), lte: msk("2026-12-26") }, online: false },
    orderBy: { startsAt: "asc" },
    include: { offering: { include: { discipline: true } }, building: true },
  });
  const byWeek = new Map<number, typeof all>();
  for (const l of all) {
    const week = Math.floor((l.startsAt.getTime() - msk("2026-09-28").getTime()) / (7 * 86_400_000));
    byWeek.set(week, [...(byWeek.get(week) ?? []), l]);
  }
  const altBuilding = (current: string | null): BuildingId => (current === "kronv" ? "chaik" : "kronv");

  for (const [week, weekLessons] of byWeek) {
    const lesson = weekLessons[(week * 5 + s.login.length) % weekLessons.length];
    const variant = week % 3; // 0 — другой корпус, 1 — другое время, 2 — отмена
    const title = lesson.offering.discipline.shortTitle ?? lesson.offering.discipline.title;
    const date = isoDay(lesson.startsAt).split("-").reverse().join(".");
    let data: { startsAt: Date; endsAt: Date; room: string | null; buildingId: string | null; status: "RESCHEDULED" | "CANCELLED" };
    let reason: string;
    let body: string;
    if (variant === 0) {
      const to = BUILDINGS.find((b) => b.id === altBuilding(lesson.buildingId))!;
      data = { startsAt: lesson.startsAt, endsAt: lesson.endsAt, room: "ауд. 1101", buildingId: to.id, status: "RESCHEDULED" };
      reason = "Аудитория занята под конференцию";
      body = `«${title}» ${date} пройдёт в корпусе ${to.title}, ауд. 1101 (было: ${lesson.building?.title}, ${lesson.room}). Маршрут — в расписании.`;
    } else if (variant === 1) {
      const [from, to] = SLOTS[5];
      const d = isoDay(lesson.startsAt);
      data = { startsAt: msk(d, from), endsAt: msk(d, to), room: lesson.room, buildingId: lesson.buildingId, status: "RESCHEDULED" };
      reason = "Преподаватель на научной конференции";
      body = `«${title}» ${date} перенесено на ${from}–${to}, ${lesson.room}.`;
    } else {
      data = { startsAt: lesson.startsAt, endsAt: lesson.endsAt, room: lesson.room, buildingId: lesson.buildingId, status: "CANCELLED" };
      reason = "Болезнь преподавателя, отработку назначат дополнительно";
      body = `«${title}» ${date} отменено. Отработку назначат дополнительно.`;
    }
    const publishedAt = addDays(lesson.startsAt, -2);
    await prisma.$transaction([
      prisma.lesson.update({ where: { id: lesson.id }, data }),
      prisma.lessonChange.create({
        data: {
          lessonId: lesson.id,
          previousStatus: lesson.status,
          newStatus: data.status,
          previousStartsAt: lesson.startsAt,
          previousEndsAt: lesson.endsAt,
          previousRoom: lesson.room,
          previousBuildingId: lesson.buildingId,
          newStartsAt: data.startsAt,
          newEndsAt: data.endsAt,
          newRoom: data.room,
          newBuildingId: data.buildingId,
          reason,
          createdAt: publishedAt,
        },
      }),
      prisma.notification.create({
        data: {
          kind: "SCHEDULE_CHANGE",
          title: data.status === "CANCELLED" ? `Отмена: ${title}` : `Изменение: ${title}`,
          body: `${body} Причина: ${reason.toLowerCase()}.`,
          important: true,
          publishedAt,
          lessonId: lesson.id,
          recipients: { create: { userId, readAt: lesson.startsAt < NOW ? lesson.startsAt : null } },
        },
      }),
    ]);
  }
}

type DemoRequest = {
  type: RequestType;
  input: Record<string, unknown>;
  submittedAt: string;
  steps: { status: "IN_PROGRESS" | "NEEDS_INFO" | "READY" | "DONE"; at: string; comment?: string }[];
};

async function seedRequests(s: StudentSeed, studentId: string, userId: string, staffUserId: string) {
  const hasStaff = s.group.faculty === STAFF.faculty;
  const demo: DemoRequest[] = hasStaff
    ? [
        {
          type: "study_certificate",
          input: { destination: "По месту работы (ООО «Пример»)", format: "electronic", copies: 1 },
          submittedAt: "2026-10-20T11:15:00+03:00",
          steps: [
            { status: "IN_PROGRESS", at: "2026-10-20T15:00:00+03:00" },
            { status: "READY", at: "2026-10-21T12:30:00+03:00", comment: "Справка подписана электронной подписью, PDF доступен" },
            { status: "DONE", at: "2026-10-21T12:31:00+03:00" },
          ],
        },
        {
          type: "transcript",
          input: { language: "en", purpose: "Программа обмена, весенний семестр 2027" },
          submittedAt: "2026-11-05T10:05:00+03:00",
          steps: [{ status: "IN_PROGRESS", at: "2026-11-06T09:40:00+03:00" }],
        },
      ]
    : [
        {
          type: "individual_schedule",
          input: {
            reason: "internship",
            dateFrom: "2026-11-16",
            dateTo: "2026-12-25",
            details: "Стажировка в команде бэкенда, 4 дня в неделю.",
          },
          submittedAt: "2026-11-02T18:20:00+03:00",
          steps: [
            {
              status: "NEEDS_INFO",
              at: "2026-11-03T13:10:00+03:00",
              comment: "Уточните, в какие дни сможете посещать практики по дискретной математике.",
            },
          ],
        },
        {
          type: "scholarship_certificate",
          input: { periodFrom: "2026-09", periodTo: "2026-10", destination: "Отдел соцзащиты", format: "paper" },
          submittedAt: "2026-10-28T09:00:00+03:00",
          steps: [
            { status: "IN_PROGRESS", at: "2026-10-28T14:00:00+03:00" },
            { status: "READY", at: "2026-10-30T11:00:00+03:00", comment: "Можно забрать в деканате: Кронверкский, 49, ауд. 1117, 10:00–17:00" },
          ],
        },
      ];

  for (const r of demo) {
    let status: DemoRequest["steps"][number]["status"] | "SUBMITTED" = "SUBMITTED";
    const request = await prisma.request.create({
      data: {
        studentId,
        type: r.type,
        payload: payloadFor(r.type, r.input),
        createdAt: new Date(r.submittedAt),
        events: {
          create: { fromStatus: null, toStatus: "SUBMITTED", actorType: "STUDENT", actorUserId: userId, createdAt: new Date(r.submittedAt) },
        },
      },
    });
    for (const step of r.steps) {
      await prisma.requestEvent.create({
        data: {
          requestId: request.id,
          fromStatus: status,
          toStatus: step.status,
          actorType: "STAFF",
          // У второго факультета в демо нет аккаунта сотрудника — событие без привязки к пользователю.
          actorUserId: hasStaff ? staffUserId : null,
          comment: step.comment,
          createdAt: new Date(step.at),
        },
      });
      await prisma.notification.create({
        data: {
          kind: "REQUEST_STATUS",
          title: `${requestCatalog[r.type].title}: статус изменён`,
          body: step.comment ?? "Статус заявки обновлён.",
          important: step.status === "NEEDS_INFO" || step.status === "READY",
          publishedAt: new Date(step.at),
          requestId: request.id,
          recipients: { create: { userId, readAt: step.status === "NEEDS_INFO" ? null : new Date(step.at) } },
        },
      });
      status = step.status;
    }
    await prisma.request.update({ where: { id: request.id }, data: { status } });
  }
}

async function seedAnnouncements() {
  const students = await prisma.studentProfile.findMany({ include: { group: true } });
  const to = (code: string | null) =>
    students.filter((s) => code === null || s.group.facultyCode === code).map((s) => ({ userId: s.userId }));

  const items: { faculty: string | null; title: string; body: string; at: string; important?: boolean }[] = [
    {
      faculty: null,
      title: "4 ноября — выходной",
      body: "Занятий нет. Онлайн-заявки принимаются как обычно, деканаты ответят 5 ноября.",
      at: "2026-10-30T12:00:00+03:00",
    },
    {
      faculty: null,
      title: "Расписание сессии",
      body: "Расписание экзаменов опубликуют 10 декабря — даты появятся в разделе «Учёба». Сессия: 28 декабря — 31 января.",
      at: "2026-11-02T10:00:00+03:00",
    },
    {
      faculty: "CHB",
      title: "Отбор на обмен — весна 2027",
      body: "Заявки до 20 ноября. Понадобится выписка оценок на английском — закажите её в разделе «Заявки».",
      at: "2026-11-01T09:00:00+03:00",
      important: true,
    },
    {
      faculty: "SE",
      title: "Ярмарка стажировок",
      body: "25 ноября, 15:00, Кронверкский, 49, актовый зал. Регистрация не нужна.",
      at: "2026-11-06T16:00:00+03:00",
    },
    {
      faculty: null,
      title: "Корпус на Гривцова: вход только с переулка",
      body: "До 30 ноября вход со стороны набережной закрыт на ремонт. Закладывайте пару лишних минут.",
      at: "2026-11-09T09:00:00+03:00",
    },
    {
      faculty: null,
      title: "Продление проездных",
      body: "Если срок действия социальной карты истекает в декабре — подайте заявление до 15 декабря.",
      at: "2026-11-20T10:00:00+03:00",
    },
  ];
  for (const a of items) {
    await prisma.notification.create({
      data: {
        kind: "ANNOUNCEMENT",
        title: a.title,
        body: a.body,
        important: a.important ?? false,
        publishedAt: new Date(a.at),
        recipients: { createMany: { data: to(a.faculty) } },
      },
    });
  }
}

// ─── Физкультура ────────────────────────────────────────────────────────────
const SPORT_SECTIONS = [
  { key: "volley", title: "Волейбол", description: "Игровые тренировки, уровень — любой." },
  { key: "fitness", title: "Фитнес", description: "Функциональный тренинг в зале." },
  { key: "swim", title: "Плавание", description: "Бассейн 25 м, нужна справка из медпункта (демо)." },
  { key: "tennis", title: "Настольный теннис", description: "Столы в спортзале корпуса на Ломоносова." },
  { key: "yoga", title: "Йога", description: "Растяжка и дыхание, коврики выдают." },
  { key: "basket", title: "Баскетбол", description: "Игровые тренировки." },
] as const;

type SportTemplate = {
  section: (typeof SPORT_SECTIONS)[number]["key"];
  weekday: number;
  slot: 3 | 4 | 5 | 6 | 7;
  building: BuildingId;
  room: string;
  coach: string;
  capacity: number;
};

const SPORT_WEEKLY: SportTemplate[] = [
  { section: "fitness", weekday: 1, slot: 5, building: "kronv", room: "Спортзал 1", coach: "Тарасов Илья Олегович", capacity: 14 },
  { section: "tennis", weekday: 1, slot: 4, building: "lom-b", room: "Спортзал", coach: "Ким Виктор Сергеевич", capacity: 8 },
  { section: "volley", weekday: 2, slot: 6, building: "sport", room: "Игровой зал", coach: "Гусева Олеся Андреевна", capacity: 12 },
  { section: "yoga", weekday: 2, slot: 4, building: "lom-m", room: "Зал 0103", coach: "Лаптева Нина Игоревна", capacity: 12 },
  { section: "fitness", weekday: 3, slot: 4, building: "kronv", room: "Спортзал 1", coach: "Тарасов Илья Олегович", capacity: 14 },
  { section: "basket", weekday: 3, slot: 6, building: "kronv", room: "Спортзал 2", coach: "Ершов Максим Павлович", capacity: 14 },
  { section: "swim", weekday: 3, slot: 7, building: "sport", room: "Бассейн", coach: "Соколова Дарья Ильинична", capacity: 10 },
  { section: "volley", weekday: 4, slot: 6, building: "sport", room: "Игровой зал", coach: "Гусева Олеся Андреевна", capacity: 12 },
  { section: "tennis", weekday: 4, slot: 5, building: "lom-b", room: "Спортзал", coach: "Ким Виктор Сергеевич", capacity: 8 },
  { section: "fitness", weekday: 5, slot: 5, building: "kronv", room: "Спортзал 1", coach: "Тарасов Илья Олегович", capacity: 14 },
  { section: "yoga", weekday: 5, slot: 6, building: "lom-m", room: "Зал 0103", coach: "Лаптева Нина Игоревна", capacity: 12 },
  { section: "swim", weekday: 6, slot: 3, building: "sport", room: "Бассейн", coach: "Соколова Дарья Ильинична", capacity: 10 },
];

const POPULAR = new Set(["volley-2", "fitness-1", "swim-3", "volley-4"]); // section-weekday, вокруг них конкуренция
const SIM_STUDENTS = 36;

/** Понедельник московской недели как @db.Date. */
const weekStartOf = (d: Date) => {
  const key = isoDay(d);
  const monday = addDays(msk(key), -(weekdayOf(key) - 1));
  return new Date(`${isoDay(monday)}T00:00:00Z`);
};

async function seedSport(termId: string) {
  const sections = new Map<string, string>();
  for (const sec of SPORT_SECTIONS) {
    const row = await prisma.sportSection.create({ data: { title: sec.title, description: sec.description } });
    sections.set(sec.key, row.id);
  }
  const buildings = new Map(BUILDINGS.map((b) => [b.id, b]));
  const currentWeek = weekStartOf(NOW);

  // Недели и тренировки на весь семестр.
  type SlotRow = { id: string; key: string; weekStart: Date; startsAt: Date; endsAt: Date; building: BuildingId; title: string };
  const allSlots: SlotRow[] = [];
  for (let ws = weekStartOf(msk(TERM.start)); ws <= msk(TERM.end); ws = addDays(ws, 7)) {
    const monday = ws.toISOString().slice(0, 10);
    await prisma.sportWeek.create({
      data: {
        weekStart: ws,
        status: ws <= currentWeek ? "DRAWN" : "OPEN",
        deadline: msk(isoDay(addDays(msk(monday), -1)), "20:00"), // воскресенье 20:00 перед неделей
        drawnAt: ws <= currentWeek ? msk(isoDay(addDays(msk(monday), -1)), "20:00") : null,
      },
    });
    for (const t of SPORT_WEEKLY) {
      const date = isoDay(addDays(msk(monday), t.weekday - 1));
      if (HOLIDAYS.has(date) || date < TERM.start || date > TERM.end) continue;
      const [from, to] = SLOTS[t.slot - 1];
      const row = await prisma.sportSlot.create({
        data: {
          sectionId: sections.get(t.section)!,
          weekStart: ws,
          startsAt: msk(date, from),
          endsAt: msk(date, to),
          buildingId: t.building,
          room: t.room,
          coach: t.coach,
          capacity: t.capacity,
        },
      });
      allSlots.push({
        id: row.id,
        key: `${t.section}-${t.weekday}`,
        weekStart: ws,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        building: t.building,
        title: SPORT_SECTIONS.find((x) => x.key === t.section)!.title,
      });
    }
  }

  // Доступность слота для реального студента — той же функцией, что и в приложении.
  const busyFor = async (studentId: string) => {
    const profile = await prisma.studentProfile.findUniqueOrThrow({ where: { id: studentId }, select: { groupId: true } });
    const lessons = await prisma.lesson.findMany({
      where: { offering: { groupId: profile.groupId }, status: { not: "CANCELLED" } },
      select: { startsAt: true, endsAt: true, online: true, building: true, offering: { select: { discipline: true } } },
    });
    return lessons.map<BusyItem>((l) => ({
      title: l.offering.discipline.title,
      startsAt: l.startsAt,
      endsAt: l.endsAt,
      place: l.online || !l.building ? null : l.building,
    }));
  };
  const availableFor = (busy: BusyItem[], s: SlotRow) => {
    const b = buildings.get(s.building)!;
    return !checkSlot(
      { startsAt: s.startsAt, endsAt: s.endsAt, place: b },
      busy.filter((x) => isoDay(x.startsAt) === isoDay(s.startsAt)),
    );
  };

  // Посещения реальных студентов: по одной тренировке в неделю, начиная со второй недели.
  const real = await prisma.studentProfile.findMany({
    where: { user: { username: { in: STUDENTS.map((x) => x.login) } } },
    select: { id: true, user: { select: { username: true } } },
  });
  const plan: Record<string, { attended: number; missed: number; prefer: string[] }> = {
    "alina.lebedeva": { attended: 9, missed: 0, prefer: ["yoga", "swim", "fitness"] },
    "timur.orlov": { attended: 5, missed: 1, prefer: ["volley", "basket", "fitness"] },
  };
  for (const r of real) {
    const p = plan[r.user.username!];
    const busy = await busyFor(r.id);
    const weeks = [...new Set(allSlots.map((s) => +s.weekStart))].sort((a, b) => a - b);
    let attended = 0;
    let missed = 0;
    for (const w of weeks.slice(1)) {
      const weekSlots = allSlots.filter((s) => +s.weekStart === w && availableFor(busy, s));
      const choice = p.prefer.map((k) => weekSlots.find((s) => s.key.startsWith(k))).find(Boolean);
      if (!choice) continue;
      const isPast = choice.endsAt < NOW;
      const isCurrent = +choice.weekStart === +currentWeek;
      if (isPast && attended < p.attended) {
        await prisma.sportBooking.create({
          data: { studentId: r.id, slotId: choice.id, weekStart: choice.weekStart, status: "ATTENDED", rank: 1, explanation: "1-й выбор" },
        });
        attended++;
      } else if (isPast && missed < p.missed) {
        await prisma.sportBooking.create({
          data: { studentId: r.id, slotId: choice.id, weekStart: choice.weekStart, status: "MISSED", rank: 1, explanation: "1-й выбор" },
        });
        missed++;
      } else if (!isPast && isCurrent) {
        await prisma.sportBooking.create({
          data: { studentId: r.id, slotId: choice.id, weekStart: choice.weekStart, status: "CONFIRMED", rank: 1, lotteryIndex: 0, explanation: "1-й выбор" },
        });
      }
    }
    // Приоритеты на ближайшую открытую неделю — только у второго студента (первый пройдёт сценарий сам).
    if (r.user.username === "timur.orlov") {
      const nextWeek = addDays(currentWeek, 7);
      const options = allSlots.filter((s) => +s.weekStart === +nextWeek && availableFor(busy, s));
      const picks = [...options.filter((s) => s.key.startsWith("volley")), ...options.filter((s) => !s.key.startsWith("volley"))].slice(0, 3);
      await prisma.sportPreference.createMany({
        data: picks.map((s, i) => ({ studentId: r.id, slotId: s.id, weekStart: nextWeek, rank: i + 1 })),
      });
    }
  }

  const alina = real.find((r) => r.user.username === "alina.lebedeva");
  if (alina) {
    await prisma.sportExtraPoints.create({
      data: { studentId: alina.id, termId, title: "Норматив: бег 1 км", points: 5, awardedAt: msk("2026-10-14", "12:00") },
    });
  }

  // Симуляция конкуренции: участники без учётных записей (войти под ними нельзя),
  // с приоритетами на ближайшие 4 открытые недели. Популярные слоты получают больше желающих.
  const simGroup = await prisma.studyGroup.create({
    data: { code: "SIM-0000", facultyCode: "SE", program: "Симуляция конкуренции (демо)", course: 1 },
  });
  let rnd = 42;
  const random = () => ((rnd = (rnd * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  const openWeeks = [...new Set(allSlots.filter((s) => s.weekStart > currentWeek).map((s) => +s.weekStart))].sort((a, b) => a - b).slice(0, 4);
  for (let i = 1; i <= SIM_STUDENTS; i++) {
    const user = await prisma.user.create({
      data: { id: randomUUID(), name: `Участник симуляции ${i}`, email: `sim-${i}@demo.university.example`, role: "student" },
    });
    const sim = await prisma.studentProfile.create({
      data: { userId: user.id, groupId: simGroup.id, recordBookNumber: `SIM${String(i).padStart(4, "0")}`, funding: "бюджет", enrolledAt: day("2026-09-01") },
    });
    for (const w of openWeeks) {
      const weekSlots = allSlots.filter((s) => +s.weekStart === w);
      const weighted = weekSlots.flatMap((s) => (POPULAR.has(s.key) ? [s, s, s, s] : [s]));
      const picks: SlotRow[] = [];
      const want = 2 + Math.floor(random() * 3);
      while (picks.length < want) {
        const s = weighted[Math.floor(random() * weighted.length)];
        if (!picks.includes(s)) picks.push(s);
      }
      await prisma.sportPreference.createMany({
        data: picks.map((s, k) => ({ studentId: sim.id, slotId: s.id, weekStart: s.weekStart, rank: k + 1 })),
      });
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
