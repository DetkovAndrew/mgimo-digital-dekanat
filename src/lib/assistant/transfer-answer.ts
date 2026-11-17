// Ответ на «успею ли с X на Y» собирает сервер из посчитанных переходов снимка, без модели. Даже с готовой строкой
// перехода GigaChat-2 склеивал заголовок одного перехода с вердиктом другого: «с английского на хемоинформатику:
// да, пешком 3 мин» — хвост пятничного перехода на английский (живой сайт 17.11, сценарий 3). Не нашли однозначно
// обе пары — вопрос уходит модели как обычно.

export type TransferFact = {
  /** День перехода по Москве, ГГГГ-ММ-ДД. */
  day: string;
  /** Слова названия и вида пары, с которой уходят, и пары, на которую идут (строчные, «ё» → «е»). */
  fromWords: string[];
  toWords: string[];
  toStartsAt: Date;
  /** Готовый ответ: вердикт, обе пары, перерыв и дорога. */
  text: string;
};

export const words = (s: string) => s.toLowerCase().replace(/ё/g, "е").split(/[^a-zа-я0-9]+/).filter(Boolean);

// Только о себе: «успею», «успеем», «успеваю», «опоздаю». «Успеет ли Тимур…» — к модели с её правилами (ревью Codex 73).
const ASKS = /(^|[^а-я])(успею|успеем|успеваю|успеваем|опоздаю|опоздаем)([^а-я]|$)/;
// Дату, «следующий вторник», «послезавтра» разбор не понимает: такой вопрос не подменяем ближайшим днём (ревью Codex 73).
const UNSUPPORTED_WHEN = /^(\d|следующ|прошл|послезавтра|через|недел|вчера|позавчера|январ|феврал|март|апрел|мая$|май$|июн|июл|август|сентябр|октябр|ноябр|декабр)/;
const FROM = new Set(["с", "со", "от", "после"]);
const TO = new Set(["на", "к", "ко", "до"]);
// «с пары по английскому», «на лекцию по философии»: служебные слова между предлогом и названием пропускаем.
const FILLER = new Set(["пары", "пару", "пар", "занятия", "занятие", "лекции", "лекцию", "практики", "практику", "семинара", "семинар", "по", "моей", "мою"]);
const WEEKDAYS: [string, number][] = [["воскрес", 0], ["понедельн", 1], ["вторн", 2], ["сред", 3], ["четверг", 4], ["пятниц", 5], ["суббот", 6]];

/** Основа слова: падежи («английского» → «англий», «хемоинформатику» → «хемоин»), но не короче 4 букв. */
const stem = (w: string) => w.slice(0, Math.max(4, Math.min(6, w.length - 2)));

function subjectAfter(ws: string[], markers: Set<string>): string | null {
  for (let i = 0; i < ws.length; i++) {
    if (!markers.has(ws[i])) continue;
    let j = i + 1;
    while (j < ws.length && FILLER.has(ws[j])) j++;
    if (j < ws.length && ws[j].length >= 4) return stem(ws[j]);
  }
  return null;
}

const dayKey = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(d);
const weekday = (key: string) => new Date(`${key}T12:00:00+03:00`).getUTCDay();

/**
 * `standalone` — вопрос первый в разговоре. Иначе день мог прозвучать раньше («посмотрим пятницу»), и без дня
 * в самом вопросе отвечает модель, она видит историю (ревью Codex 75).
 */
export function answerTransfer(question: string, facts: readonly TransferFact[], now: Date, standalone = true): string | null {
  const q = question.toLowerCase().replace(/ё/g, "е");
  if (!ASKS.test(q)) return null;
  const ws = words(q);
  if (ws.some((w) => UNSUPPORTED_WHEN.test(w))) return null;
  const from = subjectAfter(ws, FROM);
  const to = subjectAfter(ws, TO);
  if (!from || !to) return null;

  let found = facts.filter((f) => f.fromWords.some((w) => w.startsWith(from)) && f.toWords.some((w) => w.startsWith(to)));
  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000));
  const days = WEEKDAYS.filter(([s]) => ws.some((w) => w.startsWith(s)));
  if (days.length > 1) return null; // «во вторник и пятницу» — не выбираем за студента
  const named = days[0];
  // Все названные признаки дня должны совпасть: «сегодня» и «завтра» вместе не дают ни одного перехода.
  if (ws.includes("сегодня")) found = found.filter((f) => f.day === today);
  if (ws.includes("завтра")) found = found.filter((f) => f.day === tomorrow);
  if (named) found = found.filter((f) => weekday(f.day) === named[1]);
  if (!ws.includes("сегодня") && !ws.includes("завтра") && !named) {
    if (!standalone) return null;
    // День не назван — ближайший предстоящий переход (или ближайший из прошедших, если предстоящих нет).
    const ahead = found.filter((f) => f.toStartsAt > now);
    found = [...(ahead.length ? ahead : found)].sort((a, b) => a.toStartsAt.getTime() - b.toStartsAt.getTime()).slice(0, 1);
  }
  // В названный день несколько разных переходов (по одной паре дважды) — не угадываем, отвечает модель.
  if (!found.length || new Set(found.map((f) => f.text)).size > 1) return null;
  return found[0].text;
}
