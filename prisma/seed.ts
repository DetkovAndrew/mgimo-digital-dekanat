// Демонстрационные данные. ВСЕ ЛЮДИ, ОЦЕНКИ И НОМЕРА ВЫМЫШЛЕНЫ.
// Запуск: `npm run db:seed`. Seed ПОЛНОСТЬЮ пересоздаёт данные (демо-сброс).
// Пароли тестовых аккаунтов берутся из окружения (SEED_PASSWORD_*), в коде их нет.
import { existsSync } from "node:fs";
import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import type { Prisma } from "../src/generated/prisma/client";
import { requestCatalog, type RequestType } from "../src/lib/requests/catalog";
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

// ─── Время ──────────────────────────────────────────────────────────────────
// Москва — UTC+3 круглый год. Даты занятий задаём по московскому времени.
const msk = (date: string, time = "00:00") => new Date(`${date}T${time}:00+03:00`);
const day = (date: string) => new Date(`${date}T00:00:00Z`); // для полей @db.Date
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const isoDay = (d: Date) => new Date(d.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);

// Сетка пар (демонстрационная).
const SLOTS = [
  ["09:00", "10:20"],
  ["10:30", "11:50"],
  ["12:40", "14:00"],
  ["14:10", "15:30"],
  ["15:40", "17:00"],
  ["17:10", "18:30"],
] as const;

const HOLIDAYS = new Set(["2026-11-04"]); // День народного единства

// ─── Справочники ────────────────────────────────────────────────────────────
const FACULTIES = [
  { code: "MO", title: "Факультет международных отношений", shortName: "МО" },
  { code: "MEO", title: "Факультет международных экономических отношений", shortName: "МЭО" },
];

const TEACHERS = {
  belyaev: ["Беляев Олег Викторович", "профессор"],
  zorina: ["Зорина Марина Сергеевна", "доцент"],
  kalinin: ["Калинин Игорь Дмитриевич", "доцент"],
  lemoine: ["Лемуан Софи-Анна Петровна", "старший преподаватель"],
  harris: ["Харрис Елена Джоновна", "старший преподаватель"],
  sadykov: ["Садыков Ренат Ильдарович", "доцент"],
  vetrova: ["Ветрова Анна Константиновна", "доцент"],
  gromov: ["Громов Павел Алексеевич", "профессор"],
  shults: ["Шульц Ирина Викторовна", "старший преподаватель"],
  nazarov: ["Назаров Денис Олегович", "доцент"],
  frolova: ["Фролова Яна Михайловна", "доцент"],
  osipov: ["Осипов Глеб Андреевич", "преподаватель"],
} as const;
type TeacherKey = keyof typeof TEACHERS;

type OfferingSeed = {
  key: string;
  title: string;
  short?: string;
  control: "EXAM" | "CREDIT" | "GRADED_CREDIT";
  credits: number;
  teacher: TeacherKey;
};

type WeeklySlot = {
  offering: string;
  weekday: 1 | 2 | 3 | 4 | 5 | 6; // 1 — понедельник
  slot: 1 | 2 | 3 | 4 | 5 | 6;
  kind: "LECTURE" | "SEMINAR" | "LANGUAGE" | "PRACTICE";
  room: string;
  teacher?: TeacherKey;
};

type StudentSeed = {
  login: string;
  passwordEnv: string;
  name: string;
  recordBook: string;
  funding: string;
  enrolledAt: string;
  group: {
    code: string;
    faculty: string;
    program: string;
    profile: string;
    course: number;
  };
  current: OfferingSeed[];
  weekly: WeeklySlot[];
  /** Оценки за рубежный контроль (октябрь) по ключу дисциплины. */
  midterms: Record<string, number>;
  previous: (OfferingSeed & { results: (number | boolean)[] })[];
};

const STUDENTS: StudentSeed[] = [
  {
    login: "alina.lebedeva",
    passwordEnv: "SEED_PASSWORD_STUDENT_A",
    name: "Лебедева Алина Игоревна",
    recordBook: "24-МО-0417",
    funding: "бюджет",
    enrolledAt: "2025-09-01",
    group: {
      code: "МО-204",
      faculty: "MO",
      program: "41.03.05 Международные отношения",
      profile: "Мировая политика",
      course: 2,
    },
    current: [
      { key: "tmo", title: "Теория международных отношений", short: "ТМО", control: "EXAM", credits: 5, teacher: "belyaev" },
      { key: "imo", title: "История международных отношений", short: "ИМО", control: "EXAM", credits: 4, teacher: "zorina" },
      { key: "eng", title: "Английский язык", control: "GRADED_CREDIT", credits: 4, teacher: "harris" },
      { key: "fra", title: "Французский язык (второй иностранный)", short: "Французский", control: "GRADED_CREDIT", credits: 4, teacher: "lemoine" },
      { key: "wec", title: "Мировая экономика", control: "CREDIT", credits: 3, teacher: "kalinin" },
      { key: "phi", title: "Философия", control: "CREDIT", credits: 2, teacher: "sadykov" },
    ],
    weekly: [
      { offering: "tmo", weekday: 1, slot: 1, kind: "LECTURE", room: "ауд. 1012" },
      { offering: "eng", weekday: 1, slot: 2, kind: "LANGUAGE", room: "ауд. 3108" },
      { offering: "imo", weekday: 1, slot: 3, kind: "SEMINAR", room: "ауд. 2045" },
      { offering: "fra", weekday: 2, slot: 2, kind: "LANGUAGE", room: "ауд. 3214" },
      { offering: "wec", weekday: 2, slot: 3, kind: "LECTURE", room: "ауд. 1001" },
      { offering: "phi", weekday: 2, slot: 4, kind: "SEMINAR", room: "ауд. 2117" },
      { offering: "imo", weekday: 3, slot: 1, kind: "LECTURE", room: "ауд. 1012" },
      { offering: "eng", weekday: 3, slot: 2, kind: "LANGUAGE", room: "ауд. 3108" },
      { offering: "tmo", weekday: 4, slot: 2, kind: "SEMINAR", room: "ауд. 2031", teacher: "osipov" },
      { offering: "fra", weekday: 4, slot: 3, kind: "LANGUAGE", room: "ауд. 3214" },
      { offering: "wec", weekday: 5, slot: 2, kind: "SEMINAR", room: "ауд. 2203" },
      { offering: "eng", weekday: 5, slot: 3, kind: "LANGUAGE", room: "ауд. 3108" },
    ],
    midterms: { tmo: 5, imo: 4, eng: 5, fra: 3, wec: 4, phi: 5 },
    previous: [
      { key: "itmo", title: "Введение в теорию международных отношений", control: "EXAM", credits: 4, teacher: "belyaev", results: [5] },
      { key: "hist", title: "История России", control: "EXAM", credits: 4, teacher: "zorina", results: [4] },
      { key: "eng1", title: "Английский язык", control: "GRADED_CREDIT", credits: 4, teacher: "harris", results: [5] },
      { key: "fra1", title: "Французский язык (второй иностранный)", control: "GRADED_CREDIT", credits: 4, teacher: "lemoine", results: [4] },
      { key: "econ", title: "Основы экономической теории", control: "CREDIT", credits: 3, teacher: "kalinin", results: [true] },
      { key: "it", title: "Информационные технологии в международных отношениях", control: "CREDIT", credits: 2, teacher: "nazarov", results: [true] },
    ],
  },
  {
    login: "timur.orlov",
    passwordEnv: "SEED_PASSWORD_STUDENT_B",
    name: "Орлов Тимур Русланович",
    recordBook: "23-МЭО-0932",
    funding: "договор",
    enrolledAt: "2024-09-01",
    group: {
      code: "МЭО-301",
      faculty: "MEO",
      program: "38.03.01 Экономика",
      profile: "Мировая экономика",
      course: 3,
    },
    current: [
      { key: "mvko", title: "Международные валютно-кредитные отношения", short: "МВКО", control: "EXAM", credits: 5, teacher: "gromov" },
      { key: "ectr", title: "Эконометрика", control: "EXAM", credits: 4, teacher: "nazarov" },
      { key: "eng", title: "Английский язык (деловой)", short: "Английский", control: "GRADED_CREDIT", credits: 4, teacher: "harris" },
      { key: "deu", title: "Немецкий язык (второй иностранный)", short: "Немецкий", control: "GRADED_CREDIT", credits: 4, teacher: "shults" },
      { key: "cfin", title: "Корпоративные финансы", control: "CREDIT", credits: 3, teacher: "vetrova" },
      { key: "mtr", title: "Мировые товарные рынки", control: "CREDIT", credits: 3, teacher: "frolova" },
    ],
    weekly: [
      { offering: "ectr", weekday: 1, slot: 2, kind: "LECTURE", room: "ауд. 1003" },
      { offering: "ectr", weekday: 1, slot: 3, kind: "PRACTICE", room: "комп. класс 4012" },
      { offering: "mvko", weekday: 2, slot: 1, kind: "LECTURE", room: "ауд. 1001" },
      { offering: "eng", weekday: 2, slot: 2, kind: "LANGUAGE", room: "ауд. 3302" },
      { offering: "deu", weekday: 2, slot: 4, kind: "LANGUAGE", room: "ауд. 3410" },
      { offering: "cfin", weekday: 3, slot: 3, kind: "LECTURE", room: "ауд. 1014" },
      { offering: "mvko", weekday: 3, slot: 4, kind: "SEMINAR", room: "ауд. 2210" },
      { offering: "eng", weekday: 4, slot: 2, kind: "LANGUAGE", room: "ауд. 3302" },
      { offering: "mtr", weekday: 4, slot: 3, kind: "LECTURE", room: "ауд. 1003" },
      { offering: "deu", weekday: 5, slot: 1, kind: "LANGUAGE", room: "ауд. 3410" },
      { offering: "cfin", weekday: 5, slot: 2, kind: "SEMINAR", room: "ауд. 2105", teacher: "osipov" },
      { offering: "mtr", weekday: 5, slot: 3, kind: "SEMINAR", room: "ауд. 2105" },
    ],
    midterms: { mvko: 4, ectr: 3, eng: 4, deu: 5, cfin: 5, mtr: 4 },
    previous: [
      { key: "macro", title: "Макроэкономика", control: "EXAM", credits: 5, teacher: "gromov", results: [2, 4] },
      { key: "stat", title: "Статистика", control: "EXAM", credits: 4, teacher: "nazarov", results: [5] },
      { key: "eng1", title: "Английский язык", control: "GRADED_CREDIT", credits: 4, teacher: "harris", results: [4] },
      { key: "deu1", title: "Немецкий язык (второй иностранный)", control: "GRADED_CREDIT", credits: 4, teacher: "shults", results: [5] },
      { key: "acc", title: "Бухгалтерский учёт", control: "CREDIT", credits: 3, teacher: "vetrova", results: [true] },
      { key: "mkt", title: "Международный маркетинг", control: "CREDIT", credits: 2, teacher: "frolova", results: [true] },
    ],
  },
];

const STAFF = {
  login: "dekanat.mo",
  passwordEnv: "SEED_PASSWORD_STAFF",
  name: "Миронова Ксения Павловна",
  position: "Специалист по учебной работе деканата",
  faculty: "MO",
};

// ─── Утилиты ────────────────────────────────────────────────────────────────
async function createUser(login: string, name: string, password: string) {
  const { user } = await seedAuth.api.signUpEmail({
    body: { email: `${login}@demo.dekanat.example`, name, password, username: login },
  });
  return user.id;
}

function payloadFor(type: RequestType, input: Record<string, unknown>) {
  // Seed проходит через ту же валидацию, что и форма студента.
  return requestCatalog[type].schema.parse(input) as Prisma.InputJsonObject;
}

async function wipe() {
  // Порядок важен из-за внешних ключей.
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

  const teacherIds = {} as Record<TeacherKey, string>;
  for (const [key, [fullName, position]] of Object.entries(TEACHERS)) {
    const t = await prisma.teacher.create({ data: { fullName, position } });
    teacherIds[key as TeacherKey] = t.id;
  }

  const prevTerm = await prisma.academicTerm.create({
    data: {
      title: "Весенний семестр 2025/26",
      startsOn: day("2026-02-09"),
      endsOn: day("2026-06-07"),
      sessionStartsOn: day("2026-06-08"),
      sessionEndsOn: day("2026-06-30"),
    },
  });
  const term = await prisma.academicTerm.create({
    data: {
      title: "Осенний семестр 2026/27",
      startsOn: day("2026-09-01"),
      endsOn: day("2026-12-27"),
      sessionStartsOn: day("2027-01-09"),
      sessionEndsOn: day("2027-01-29"),
    },
  });

  // Сотрудник деканата факультета МО
  const staffUserId = await createUser(STAFF.login, STAFF.name, passwords[STAFF.login]);
  await prisma.user.update({ where: { id: staffUserId }, data: { role: "staff" } });
  await prisma.staffProfile.create({
    data: { userId: staffUserId, position: STAFF.position, facultyCode: STAFF.faculty },
  });

  for (const s of STUDENTS) {
    await seedStudent(s, passwords[s.login], { term: term.id, prevTerm: prevTerm.id }, teacherIds, staffUserId);
  }

  await seedAnnouncements();

  const counts = {
    users: await prisma.user.count(),
    lessons: await prisma.lesson.count(),
    changes: await prisma.lessonChange.count(),
    grades: await prisma.gradeResult.count(),
    requests: await prisma.request.count(),
    notifications: await prisma.notification.count(),
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
  const offerings: Record<string, { id: string; teacherId: string; title: string }> = {};
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
    offerings[o.key] = { id: offering.id, teacherId: teacherIds[o.teacher], title: o.short ?? o.title };
  }

  // Расписание на весь семестр по недельному шаблону
  const lessons: Prisma.LessonCreateManyInput[] = [];
  for (let d = msk("2026-09-01"); d <= msk("2026-12-27"); d = addDays(d, 1)) {
    const date = isoDay(d);
    // День недели по московской дате (полдень UTC той же даты — без сдвига суток).
    const mskWeekday = ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
    if (HOLIDAYS.has(date)) continue;
    for (const w of s.weekly.filter((x) => x.weekday === mskWeekday)) {
      const [from, to] = SLOTS[w.slot - 1];
      lessons.push({
        offeringId: offerings[w.offering].id,
        kind: w.kind,
        startsAt: msk(date, from),
        endsAt: msk(date, to),
        room: w.room,
        teacherId: w.teacher ? teacherIds[w.teacher] : null,
      });
    }
  }
  await prisma.lesson.createMany({ data: lessons });

  // Переносы: по одному изменению в неделю, с октября по декабрь,
  // чтобы в любой день показа рядом было свежее изменение.
  const allLessons = await prisma.lesson.findMany({
    where: { offering: { groupId: group.id }, startsAt: { gte: msk("2026-10-01"), lte: msk("2026-12-26") } },
    orderBy: { startsAt: "asc" },
    include: { offering: { include: { discipline: true } } },
  });
  const byWeek = new Map<number, typeof allLessons>();
  for (const l of allLessons) {
    const week = Math.floor((l.startsAt.getTime() - msk("2026-09-28").getTime()) / (7 * 86_400_000));
    byWeek.set(week, [...(byWeek.get(week) ?? []), l]);
  }
  for (const [week, weekLessons] of byWeek) {
    const lesson = weekLessons[(week * 5 + s.login.length) % weekLessons.length];
    const variant = week % 3; // 0 — другая аудитория, 1 — другое время, 2 — отмена
    const title = lesson.offering.discipline.shortTitle ?? lesson.offering.discipline.title;
    const date = isoDay(lesson.startsAt);
    let data: { startsAt: Date; endsAt: Date; room: string | null; status: "RESCHEDULED" | "CANCELLED" };
    let reason: string;
    let body: string;
    if (variant === 0) {
      data = { startsAt: lesson.startsAt, endsAt: lesson.endsAt, room: "ауд. 1101 (Большой зал)", status: "RESCHEDULED" };
      reason = "Аудитория занята под конференцию";
      body = `Занятие «${title}» ${date} пройдёт в ауд. 1101 (Большой зал) вместо ${lesson.room}.`;
    } else if (variant === 1) {
      const [from, to] = SLOTS[5];
      data = { startsAt: msk(date, from), endsAt: msk(date, to), room: lesson.room, status: "RESCHEDULED" };
      reason = "Преподаватель на научной конференции";
      body = `Занятие «${title}» ${date} перенесено на ${from}–${to}, ${lesson.room}.`;
    } else {
      data = { startsAt: lesson.startsAt, endsAt: lesson.endsAt, room: lesson.room, status: "CANCELLED" };
      reason = "Болезнь преподавателя, отработка будет назначена дополнительно";
      body = `Занятие «${title}» ${date} отменено. Отработку назначат дополнительно.`;
    }
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
          newStartsAt: data.startsAt,
          newEndsAt: data.endsAt,
          newRoom: data.room,
          reason,
          createdAt: addDays(lesson.startsAt, -2),
        },
      }),
      prisma.notification.create({
        data: {
          kind: "SCHEDULE_CHANGE",
          title: data.status === "CANCELLED" ? `Отмена: ${title}` : `Изменение: ${title}`,
          body: `${body} Причина: ${reason.toLowerCase()}.`,
          important: true,
          publishedAt: addDays(lesson.startsAt, -2),
          lessonId: lesson.id,
          recipients: { create: { userId, readAt: lesson.startsAt < new Date() ? lesson.startsAt : null } },
        },
      }),
    ]);
  }

  // Успеваемость текущего семестра: рубежный контроль (с оценками), работы, итоговый контроль.
  const keys = Object.keys(offerings);
  for (const [i, key] of keys.entries()) {
    const o = offerings[key];
    const spec = s.current.find((c) => c.key === key)!;
    const midterm = await prisma.assessment.create({
      data: {
        offeringId: o.id,
        kind: "MIDTERM",
        title: "Рубежный контроль 1",
        scheduledAt: msk(`2026-10-${String(13 + i * 2).padStart(2, "0")}`, "10:30"),
      },
    });
    await prisma.gradeResult.create({
      data: {
        studentId: student.id,
        assessmentId: midterm.id,
        grade: s.midterms[key],
        gradedAt: msk(`2026-10-${String(15 + i * 2).padStart(2, "0")}`, "18:00"),
      },
    });

    // Работа с дедлайном: у части дисциплин уже сдана, у части — впереди (для напоминаний).
    const dueAt = msk(isoDay(addDays(msk("2026-11-12"), i * 6)), "23:59");
    const assignment = await prisma.assessment.create({
      data: {
        offeringId: o.id,
        kind: "ASSIGNMENT",
        title: i % 2 === 0 ? "Эссе" : "Аналитическая записка",
        dueAt,
      },
    });
    await prisma.notification.create({
      data: {
        kind: "DEADLINE",
        title: `Через неделю срок: ${assignment.title.toLowerCase()} — ${o.title}`,
        body: `Сдать до ${isoDay(dueAt)} 23:59 через преподавателя дисциплины.`,
        publishedAt: addDays(dueAt, -7),
        recipients: { create: { userId } },
      },
    });

    await prisma.assessment.create({
      data: {
        offeringId: o.id,
        kind: spec.control,
        title: spec.control === "EXAM" ? "Экзамен" : spec.control === "CREDIT" ? "Зачёт" : "Зачёт с оценкой",
        scheduledAt: msk(isoDay(addDays(msk("2027-01-11"), i * 3)), "10:00"),
        room: spec.control === "EXAM" ? "ауд. 1012" : null,
      },
    });
  }

  // Прошлый семестр: закрытая сессия (включая пересдачу).
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
    const exam = await prisma.assessment.create({
      data: {
        offeringId: offering.id,
        kind: p.control,
        title: p.control === "EXAM" ? "Экзамен" : p.control === "CREDIT" ? "Зачёт" : "Зачёт с оценкой",
        scheduledAt: msk("2026-06-15", "10:00"),
      },
    });
    for (const [attemptIndex, r] of p.results.entries()) {
      await prisma.gradeResult.create({
        data: {
          studentId: student.id,
          assessmentId: exam.id,
          attempt: attemptIndex + 1,
          grade: typeof r === "number" ? r : null,
          passed: typeof r === "boolean" ? r : null,
          comment: attemptIndex > 0 ? "Пересдача" : null,
          gradedAt: msk(attemptIndex > 0 ? "2026-09-10" : "2026-06-16", "15:00"),
        },
      });
    }
  }

  await seedRequests(s, student.id, userId, staffUserId);
}

type DemoRequest = {
  type: RequestType;
  input: Record<string, unknown>;
  submittedAt: string;
  steps: { status: "IN_PROGRESS" | "NEEDS_INFO" | "READY" | "DONE"; at: string; comment?: string }[];
};

async function seedRequests(s: StudentSeed, studentId: string, userId: string, staffUserId: string) {
  const isA = s.group.faculty === "MO";
  const demo: DemoRequest[] = isA
    ? [
        {
          type: "study_certificate",
          input: { destination: "По месту работы (ООО «Пример»)", format: "electronic", copies: 1 },
          submittedAt: "2026-10-20T11:15:00+03:00",
          steps: [
            { status: "IN_PROGRESS", at: "2026-10-20T15:00:00+03:00" },
            { status: "READY", at: "2026-10-21T12:30:00+03:00", comment: "Справка подписана, PDF доступен" },
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
            details: "Стажировка в аналитическом отделе банка, 4 дня в неделю.",
          },
          submittedAt: "2026-11-02T18:20:00+03:00",
          steps: [
            {
              status: "NEEDS_INFO",
              at: "2026-11-03T13:10:00+03:00",
              comment: "Уточните, в какие дни недели вы сможете посещать семинары по эконометрике.",
            },
          ],
        },
        {
          type: "scholarship_certificate",
          input: { periodFrom: "2026-09", periodTo: "2026-10", destination: "Отдел соцзащиты", format: "paper" },
          submittedAt: "2026-10-28T09:00:00+03:00",
          steps: [
            { status: "IN_PROGRESS", at: "2026-10-28T14:00:00+03:00" },
            { status: "READY", at: "2026-10-30T11:00:00+03:00", comment: "Можно забрать в деканате, каб. 215, 10:00–17:00" },
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
          // У факультета МЭО в демо нет аккаунта сотрудника — событие без привязки к пользователю.
          actorUserId: isA ? staffUserId : null,
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
  const toFaculty = (code: string | null) =>
    students.filter((s) => code === null || s.group.facultyCode === code).map((s) => ({ userId: s.userId }));

  const items: { faculty: string | null; title: string; body: string; at: string; important?: boolean }[] = [
    {
      faculty: null,
      title: "Расписание зимней сессии",
      body: "Расписание экзаменов опубликуют 10 декабря. Сессия: 9–29 января 2027 г.",
      at: "2026-11-02T10:00:00+03:00",
    },
    {
      faculty: null,
      title: "4 ноября — выходной день",
      body: "Занятий нет. Деканаты не работают, онлайн-заявки принимаются как обычно.",
      at: "2026-10-30T12:00:00+03:00",
    },
    {
      faculty: "MO",
      title: "Отбор на программы обмена — весна 2027",
      body: "Заявки принимаются до 20 ноября. Понадобится выписка оценок на английском — закажите её в разделе «Заявки».",
      at: "2026-11-01T09:00:00+03:00",
      important: true,
    },
    {
      faculty: "MEO",
      title: "Ярмарка стажировок МЭО",
      body: "25 ноября, 15:00, Большой зал. Банки, консалтинг, госкорпорации — регистрация не нужна.",
      at: "2026-11-06T16:00:00+03:00",
    },
    {
      faculty: null,
      title: "Продление студенческих проездных",
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
        recipients: { createMany: { data: toFaculty(a.faculty) } },
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
