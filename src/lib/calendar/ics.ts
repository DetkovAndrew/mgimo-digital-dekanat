// Календарь iCalendar (RFC 5545) без зависимостей: подписка, файл и одно событие (docs/plans/calendar.md).
// Время — UTC («…Z»), поэтому VTIMEZONE не нужен; календарь сам покажет время в поясе телефона.

export type IcsEvent = {
  /** Стабильный: при переносе, отмене и возврате пары событие обновляется на месте. */
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  location?: string | null;
  description?: string | null;
  url?: string | null;
  cancelled?: boolean;
  /** Напоминание за N минут (в файле; подписки напоминания обычно отключают — решает календарь). */
  alarmMinutes?: number;
};

/** Текст свойства: экранирование «\ ; ,», перевод строки — «\n», прочие управляющие символы убираем (нет CRLF-инъекций). */
export function icsText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Перенос длинной строки: не больше 75 октетов, продолжение начинается с пробела; символ UTF-8 не разрываем. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length ? 74 : 75; // у продолжения первый октет — пробел
    if (size + n > limit) {
      out.push(cur);
      cur = "";
      size = 0;
    }
    cur += ch;
    size += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/** 2026-11-19T12:20:00.000Z → 20261119T122000Z */
export const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function buildCalendar(events: IcsEvent[], opts: { name: string; now?: Date; feed?: boolean }): string {
  const now = icsDate(opts.now ?? new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//University//Tsifrovoy dekanat//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsText(opts.name)}`,
    "X-WR-TIMEZONE:Europe/Moscow",
  ];
  // Подсказка подписанному календарю, как часто перечитывать; клиент может её не соблюдать.
  if (opts.feed) lines.push("REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H");
  for (const e of events) {
    lines.push("BEGIN:VEVENT", `UID:${icsText(e.uid)}`, `DTSTAMP:${now}`, `DTSTART:${icsDate(e.start)}`, `DTEND:${icsDate(e.end)}`, `SUMMARY:${icsText(e.summary)}`);
    if (e.location) lines.push(`LOCATION:${icsText(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${icsText(e.description)}`);
    if (e.url) lines.push(`URL:${icsText(e.url)}`);
    lines.push(`STATUS:${e.cancelled ? "CANCELLED" : "CONFIRMED"}`, `TRANSP:${e.cancelled ? "TRANSPARENT" : "OPAQUE"}`);
    if (e.alarmMinutes && !e.cancelled) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsText(e.summary)}`, `TRIGGER:-PT${e.alarmMinutes}M`, "END:VALARM");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
