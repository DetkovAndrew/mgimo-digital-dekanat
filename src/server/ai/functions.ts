import "server-only";
import { FIND_DURATIONS, findHref, parseFind } from "@/lib/campus/find";
import type { ChatFunction } from "./gigachat";

// Функции, которые модель может вызвать. Ничего не пишут: find_free_rooms читает свободное время, book_room только
// готовит бронь — бронирует студент кнопкой в карточке (решение капитана 13.11, docs/plans/assistant.md).
export const FIND_FREE_ROOMS: ChatFunction = {
  name: "find_free_rooms",
  description:
    "Точные свободные интервалы бронируемых аудиторий (коворкинги, переговорные, аудитории) на один день. Вызывай, когда студент ищет, где и когда можно забронировать аудиторию.",
  parameters: {
    type: "object",
    properties: {
      day: { type: "string", description: "Дата ГГГГ-ММ-ДД (сегодня и до 6 дней вперёд)" },
      after: { type: "string", description: "Не раньше, ЧЧ:ММ" },
      before: { type: "string", description: "Не позже, ЧЧ:ММ" },
      building: { type: "string", enum: ["kronv", "lom-m"], description: "kronv — Главный корпус, lom-m — корпус М (Ломоносова, 9)" },
      kinds: { type: "array", items: { type: "string", enum: ["COWORKING", "MEETING", "CLASSROOM"] }, description: "Коворкинг, переговорная, обычная аудитория" },
      minMinutes: { type: "integer", description: "Минимальная длительность, минут (30–180), по умолчанию 60" },
    },
    required: ["day"],
  },
};

type FreeRooms = Awaited<ReturnType<typeof import("../dal/rooms").findFreeRooms>>;
const KIND: Record<string, string> = { COWORKING: "коворкинг", MEETING: "переговорная", CLASSROOM: "аудитория" };

/**
 * Ответ на поиск аудиторий собирает сервер, а не модель: пересказывая список, GigaChat переставлял интервалы
 * между аудиториями (журнал, запись 29). Модель только поняла вопрос и выбрала параметры.
 */
export function formatFreeRooms(r: FreeRooms): string {
  if ("error" in r) return `${r.error}. Посмотрите [аудитории](/rooms).`;
  const date = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${r.day}T12:00:00+03:00`));
  const when = [r.after && `после ${r.after}`, r.before && `до ${r.before}`].filter(Boolean).join(" ");
  // Быстрая бронь на это время, если студент назвал начало (минуты — по сетке брони): /rooms/find сам перепроверит.
  // Длительность — вверх до ближайшей из быстрой брони (45 мин → 60), чтобы ссылка не меняла смысл вопроса.
  const m = FIND_DURATIONS.find((x) => x >= r.minMinutes) ?? FIND_DURATIONS.at(-1)!;
  const q = r.after ? findHref(parseFind({ d: r.day, t: r.after, m: String(m), ...(r.building ? { b: r.building } : {}) })) : null;
  const quick = q && q.includes(`t=${encodeURIComponent(r.after!)}`) ? q : null;
  if (!r.rooms.length) return `${date[0].toUpperCase()}${date.slice(1)}${when ? ` ${when}` : ""} свободных аудиторий для брони нет. Попробуйте другой день: [аудитории](/rooms).`;
  return [
    `Свободно ${date}${when ? ` ${when}` : ""}:`,
    ...r.rooms.map((x) => `- [${x.number} ${x.name === x.kind ? KIND[x.kind] ?? "аудитория" : x.name}](${x.link}) (${x.building}, ${x.capacity} мест): ${x.free.join(", ")}`),
    "Откройте аудиторию, выберите время и нажмите «Забронировать».",
    ...(quick ? [`Или сразу: [найти и забронировать на это время](${quick}).`] : []),
  ].join("\n");
}

export const BOOK_ROOM: ChatFunction = {
  name: "book_room",
  description:
    "Подготовить бронь аудитории для студента: сервер проверит правила, квоты и свободное время и покажет карточку с кнопкой «Забронировать». Вызывай, когда студент просит забронировать (оформить, занять) аудиторию, коворкинг или переговорную. Если аудиторию не назвали — не указывай room, сервер подберёт свободную.",
  parameters: {
    type: "object",
    properties: {
      day: { type: "string", description: "Дата ГГГГ-ММ-ДД (сегодня и до 6 дней вперёд)" },
      start: { type: "string", description: "Начало ЧЧ:ММ, минуты 00 или 30" },
      minutes: { type: "integer", description: "Длительность в минутах: 30, 60, 90, 120, 150 или 180. По умолчанию 60" },
      room: { type: "string", description: "Номер аудитории из четырёх цифр, если студент его назвал" },
      building: { type: "string", enum: ["kronv", "lom-m"], description: "kronv — Главный корпус, lom-m — корпус М (Ломоносова, 9)" },
      kinds: { type: "array", items: { type: "string", enum: ["COWORKING", "MEETING", "CLASSROOM"] }, description: "Какую аудиторию подобрать, если номер не назван" },
      minCapacity: { type: "integer", description: "Сколько человек, если студент сказал" },
      purpose: { type: "string", description: "Для чего, коротко, словами студента (до 120 символов)" },
    },
    required: ["day", "start"],
  },
};

type Prepared = Awaited<ReturnType<typeof import("../dal/rooms").prepareBooking>>;

/** Текст к карточке брони собирает сервер. Сама бронь — только по нажатию студента. */
export function formatPrepared(r: Prepared): string {
  if (!r.ok) {
    const alt = r.alternatives?.length ? ` Свободны в это время: ${r.alternatives.join(", ")}.` : "";
    const windows = r.windows?.length ? ["", "В этот день свободно:", ...r.windows.map((w) => `- ${w}`), "Назовите время, и я подготовлю бронь."].join("\n") : "";
    return `Не получится: ${r.error[0].toLowerCase()}${r.error.slice(1)}.${alt} Подобрать время можно в [поиске свободных](/rooms/find).${windows}`;
  }
  const p = r.proposal;
  const date = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${p.day}T12:00:00+03:00`));
  return `Готово к брони: **${p.number}** (${p.name}, ${p.building}, ${p.capacity} мест), ${date}, с ${p.start} до ${p.end}. Цель: «${p.purpose}». Проверьте и нажмите «Забронировать».`;
}
