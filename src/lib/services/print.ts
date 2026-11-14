import { z } from "zod";

// Печать по коду (docs/plans/services.md): правила, стоимость, подсчёт страниц PDF в браузере. Числа — демо.

export const PRINT_RULES = {
  monthlyPages: 100,
  /** Цветная страница стоит как 4 чёрно-белых. */
  colorFactor: 4,
  maxPages: 200,
  maxCopies: 5,
  maxQueued: 3,
  ttlHours: 24,
  /** Больше не читаем в браузере: число страниц студент вводит сам. */
  maxFileBytes: 20 * 1024 * 1024,
  fileNameMax: 120,
} as const;

export const printCost = (pages: number, copies: number, color: boolean) => pages * copies * (color ? PRINT_RULES.colorFactor : 1);

/** Начало месяца по Москве: бюджет печати считается по месяцу создания задания. */
export function mskMonthStart(d: Date): Date {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit" }).format(d).split("-");
  return new Date(`${y}-${m}-01T00:00:00+03:00`);
}

/** Имя файла только для показа: без управляющих символов и путей, не длиннее 120. */
export const cleanFileName = (name: string) =>
  name
    .replace(/^.*[\\/]/, "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, PRINT_RULES.fileNameMax);

export const PrintJobInput = z.object({
  fileName: z.string().transform(cleanFileName).pipe(z.string().min(1, "Выберите файл или назовите задание")),
  pages: z.coerce.number().int("Целое число страниц").min(1, "Хотя бы одна страница").max(PRINT_RULES.maxPages, `Не больше ${PRINT_RULES.maxPages} страниц`),
  copies: z.coerce.number().int().min(1).max(PRINT_RULES.maxCopies, `Не больше ${PRINT_RULES.maxCopies} копий`),
  color: z.boolean(),
  duplex: z.boolean(),
});

/**
 * Сколько страниц в PDF — без библиотеки и без отправки файла: корневой узел дерева страниц хранит /Count.
 * Если дерево сжато (объектные потоки PDF 1.5+), считаем объекты /Type /Page; не вышло — null, студент вводит сам.
 */
/** Сколько символов вокруг /Type /Pages смотреть: у корня с длинным /Kids счётчик стоит далеко. */
const DICT_WINDOW = 2000;

export function countPdfPages(bytes: Uint8Array): number | null {
  const text = new TextDecoder("latin1").decode(bytes);
  if (!text.startsWith("%PDF-")) return null;
  let best = 0;
  let seen = 0;
  for (const m of text.matchAll(/\/Type\s*\/Pages\b/g)) {
    // /Count стоит в том же словаре — до или после /Type. Окно ограничено: поиск назад по всему файлу давал
    // квадратичное время на специально собранном PDF (ревью Codex 48).
    if (++seen > 5000) break;
    const window = text.slice(Math.max(0, m.index - DICT_WINDOW), m.index + DICT_WINDOW);
    const start = window.lastIndexOf("<<", Math.min(DICT_WINDOW, m.index));
    const count = /\/Count\s+(\d+)/.exec(window.slice(Math.max(0, start)));
    if (count) best = Math.max(best, Number(count[1]));
  }
  if (!best) {
    // По одному совпадению и с ранним выходом: массив всех совпадений на большом файле занимал десятки МБ памяти телефона.
    const page = /\/Type\s*\/Page(?![a-zA-Z])/g;
    while (best <= 10_000 && page.exec(text)) best++;
  }
  return best >= 1 && best <= 10_000 ? best : null;
}

/** «482913» → «482 913»: код читают вслух и вводят у принтера. */
export const formatPrintCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;
