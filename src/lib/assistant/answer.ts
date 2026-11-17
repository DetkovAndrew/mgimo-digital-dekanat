// Ответ помощника: только текст, **жирный** и ссылки [текст](/путь) на экраны кабинета.
// Сервер оставляет лишь ссылки из снимка кабинета (sanitizeAnswer), клиент дополнительно
// принимает только относительные пути (parseInline). HTML не отрисовывается никогда.

export const MAX_ANSWER_CHARS = 2000;

const isLocalPath = (href: string) => /^\/(?!\/)[\w\-/?=&.%+#]*$/.test(href);

// Один и тот же разбор ссылок на сервере и в браузере: всё, что клиент сделает ссылкой, сервер уже проверил.
const LINK = /\[([^[\]\n]+)\]\(([^)\s]+)\)/g;

/** Сервер: оставить только разрешённые ссылки (в каноническом виде); голые пути превратить в ссылки «открыть». */
export function sanitizeAnswer(text: string, allowed: ReadonlySet<string> | ((href: string) => string | null)): string {
  const check = typeof allowed === "function" ? allowed : (h: string) => (allowed.has(h) ? h : null);
  const canon = (href: string) => {
    const c = check(href);
    return c && isLocalPath(c) ? c : null;
  };
  let s = text.replace(/\r/g, "").trim();
  // 1. Голый путь в тексте («здесь: /requests/new?type=…»). Скобку «(» не считаем началом: это уже ссылка.
  //    «#» — для служб: «/services/support#scholarship» (прогон 17.11, сценарий 34, оставался текстом).
  s = s.replace(/(^|[\s:«])(\/[\w\-/?=&%+#]{1,200}?)(?=[.,;:!?)»]?(?:\s|$))/gm, (m, pre: string, href: string) => {
    const c = canon(href);
    return c ? `${pre}[открыть](${c})` : m;
  });
  // 2. Путь в квадратных скобках, как в снимке: [/lessons/…].
  s = s.replace(/\[(\/[^\]\s]{1,200})\](?!\()/g, (_, href: string) => {
    const c = canon(href);
    return c ? `[открыть](${c})` : "";
  });
  // 3. Обрывок ссылки без адреса: «[страница службы]/care» (прогон 17.11, сценарий 36) — остаётся только текст.
  //    До проверки ссылок: из «[[жми]](/чужое)» получится ссылка, и её проверят шаги 4–5 (ревью Codex 73).
  s = s.replace(/\[([^[\]\n]+)\](?!\()(?:\/[\w\-/?=&%+#]*)?/g, "$1");
  // 4. Ссылки [текст](путь): чужие и выдуманные превращаются в обычный текст.
  s = s.replace(LINK, (_, label: string, href: string) => {
    const c = canon(href);
    return c ? `[${label}](${c})` : label;
  });
  // 5. Замена могла склеить новую ссылку из вложенных скобок («[a [b](/x)](/y)» → «[a b](/y)»): проверяем ещё раз,
  //    пока текст не перестанет меняться. Остаются только ссылки, уже приведённые к каноническому виду.
  let stable = false;
  for (let i = 0; i < 20 && !stable; i++) {
    const prev = s;
    s = s.replace(LINK, (m, label: string, href: string) => (canon(href) === href ? m : label));
    stable = prev === s;
  }
  // Вложенность глубже предела (ревью Codex 74): без квадратных скобок клиент не соберёт ни одной ссылки.
  if (!stable) s = s.replace(/[[\]]/g, "");
  return s.length > MAX_ANSWER_CHARS ? `${s.slice(0, MAX_ANSWER_CHARS - 1)}…` : s;
}

/**
 * Сервер, только для текста модели: строки с «полями ссылки» каталога («&format=electronic|paper», «reason=текст»)
 * убрать целиком — модель пересказывала их студенту (прогон 17.11, сценарии 11, 20, 32). Признак — «имя=» с именем
 * поля каталога (`names`) или подпись «поля ссылки»: «cat|grep», «en|ru», «a=b» в цели брони или уведомлении —
 * обычный текст (ревью Codex 69, 70). Внутри адреса ссылки поля законны, их не трогаем.
 */
export function dropCatalogFields(text: string, names: ReadonlySet<string>): string {
  const leaks = (line: string) => {
    const t = line.replace(/\]\([^)\s]*\)/g, "]");
    if (/поля ссылки|студенту не показывать/i.test(t)) return true;
    return [...t.matchAll(/(?:^|[^a-z_])&?([a-z_]+)=/g)].some((m) => names.has(m[1]));
  };
  const lines = text.split("\n");
  const kept = lines.filter((line) => !leaks(line));
  return kept.length === lines.length ? text : kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export type OfficeFacts = { href: string; title: string; where: string; hours: string; email: string; subject: string };

/** Постоянные части шаблона темы — без «<…>», которые заполняет студент. */
const subjectParts = (subject: string) =>
  subject.split(/<[^>]*>/).map((p) => p.replace(/^[\s,:]+|[\s,:]+$/g, "").toLowerCase()).filter((p) => p.length >= 4);

/**
 * Сервер: ответ ведёт на службу, но без её места, часов, почты или темы письма — дописать их из справочника. Модель
 * то и дело теряла почту или адрес при верной службе (прогон 17.11, сценарии 34 и 35); эти факты сервер знает точно.
 * Каждая служба и каждый факт проверяются отдельно; тема засчитывается, только если в ответе есть подписанная тема
 * в кавычках с постоянными частями шаблона, и одна такая тема закрывает одну службу (ревью Codex 69–71).
 */
export function completeOfficeContacts(text: string, offices: readonly OfficeFacts[]): string {
  // Служба в ответе — по ссылке на неё или по её почте (ссылку модель иногда ломала: сценарий 36).
  const linked = offices.filter((o) => text.includes(`](${o.href})`) || text.includes(o.email));
  // Каждая тема в кавычках закрывает одну службу: ту, чей шаблон подробнее («Обмен: …, группа P3212» — не деканату
  // с «<Тема>, группа P3212»), а при одинаковых шаблонах (деканат и библиотека) — ближайшую ссылку на службу.
  const at = (o: OfficeFacts) => text.indexOf(`](${o.href})`);
  const detail = (o: OfficeFacts) => subjectParts(o.subject).join("").length;
  const covered = new Set<OfficeFacts>();
  for (const m of text.matchAll(/тем[аеуы][^«\n]{0,30}«([^»\n]+)»/gi)) {
    const q = m[1].toLowerCase();
    const fits = linked.filter((o) => !covered.has(o) && subjectParts(o.subject).every((p) => q.includes(p)));
    fits.sort((a, b) => detail(b) - detail(a) || Math.abs(at(a) - m.index) - Math.abs(at(b) - m.index));
    if (fits[0]) covered.add(fits[0]);
  }
  const add: string[] = [];
  for (const o of linked) {
    const lead = linked.length > 1 ? `${o.title}: ` : "";
    if (!text.includes(o.where)) add.push(`${lead}${o.where}, ${o.hours}.`);
    else if (!text.includes(o.hours)) add.push(`${lead}часы: ${o.hours}.`);
    const mail = text.includes(o.email) ? null : `почта ${o.email}`;
    const subject = covered.has(o) ? null : `тема письма: «${o.subject}»`;
    if (mail || subject) add.push(`${lead}${[mail, subject].filter(Boolean).join(", ")}.`);
    if (!text.includes(`](${o.href})`)) add.push(`[${o.title}: страница службы](${o.href})`);
  }
  if (!add.length) return text;
  const s = `${text}\n${add.map((l) => l[0].toUpperCase() + l.slice(1)).join("\n")}`;
  return s.length > MAX_ANSWER_CHARS ? text : s;
}

export type Inline = { kind: "text"; text: string } | { kind: "bold"; text: string } | { kind: "link"; text: string; href: string };

/** Клиент: разбор строки на текст, жирный и ссылки. Неподходящая ссылка остаётся текстом. */
export function parseInline(line: string): Inline[] {
  const out: Inline[] = [];
  const re = new RegExp(`\\*\\*([^*\\n]+)\\*\\*|${LINK.source}`, "g");
  let last = 0;
  for (let m = re.exec(line); m; m = re.exec(line)) {
    if (m.index > last) out.push({ kind: "text", text: line.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ kind: "bold", text: m[1] });
    else if (isLocalPath(m[3])) out.push({ kind: "link", text: m[2], href: m[3] });
    else out.push({ kind: "text", text: m[2] });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ kind: "text", text: line.slice(last) });
  return out;
}
