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
  // 3. Ссылки [текст](путь): чужие и выдуманные превращаются в обычный текст.
  s = s.replace(LINK, (_, label: string, href: string) => {
    const c = canon(href);
    return c ? `[${label}](${c})` : label;
  });
  // 4. Замена могла склеить новую ссылку из вложенных скобок («[a [b](/x)](/y)» → «[a b](/y)»): проверяем ещё раз,
  //    пока текст не перестанет меняться. Остаются только ссылки, уже приведённые к каноническому виду.
  for (let i = 0, prev = ""; i < 5 && prev !== s; i++) {
    prev = s;
    s = s.replace(LINK, (m, label: string, href: string) => (canon(href) === href ? m : label));
  }
  return s.length > MAX_ANSWER_CHARS ? `${s.slice(0, MAX_ANSWER_CHARS - 1)}…` : s;
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
