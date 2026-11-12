"use client";

import { ArrowUp, RotateCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { parseInline } from "@/lib/assistant/answer";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Что у меня завтра и где?",
  "Сколько баллов не хватает до зачёта?",
  "Когда можно на физкультуру и есть ли места?",
  "Как заказать справку для военкомата?",
];

/** Ответ помощника: строки, пункты списка, жирный и ссылки на экраны кабинета. HTML не отрисовывается. */
function Answer({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim());
  const inline = (line: string) =>
    parseInline(line).map((x, i) =>
      x.kind === "link" ? (
        <Link key={i} href={x.href} transitionTypes={["nav-forward"]} className="font-medium break-words text-brand underline decoration-brand/40 underline-offset-2">
          {x.text}
        </Link>
      ) : x.kind === "bold" ? (
        <b key={i} className="font-semibold">
          {x.text}
        </b>
      ) : (
        <span key={i}>{x.text}</span>
      ),
    );
  return (
    <div className="space-y-1.5">
      {lines.map((l, i) => {
        const item = l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/);
        return item ? (
          <p key={i} className="flex gap-2">
            <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-ink-3" />
            <span className="min-w-0">{inline(item[1])}</span>
          </p>
        ) : (
          <p key={i}>{inline(l)}</p>
        );
      })}
    </div>
  );
}

const MAX_BODY_BYTES = 20 * 1024; // сервер принимает до 24 КиБ

/** Последние реплики, которые помещаются в лимит тела запроса: старые пары уходят первыми. */
function fit(owner: string, history: Msg[]) {
  let h = history.slice(-12);
  const size = (m: Msg[]) => new TextEncoder().encode(JSON.stringify({ owner, messages: m })).length;
  while (h.length > 1 && (size(h) > MAX_BODY_BYTES || h[0].role !== "user")) h = h.slice(1);
  return h;
}

export function Chat({ configured, owner }: { configured: boolean; owner: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);

  // Ушли со страницы или вышли из аккаунта: запрос отменяется, запоздалый ответ не покажется.
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    // Новые браузеры возвращают из scrollIntoView Promise, а эффект не должен его возвращать.
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (messages.length || pending) void end.current?.scrollIntoView({ block: "end", behavior: calm ? "auto" : "smooth" });
  }, [messages, pending]);

  async function send(history: Msg[]) {
    abort.current?.abort();
    const ctl = (abort.current = new AbortController());
    setMessages(history);
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, messages: fit(owner, history) }),
        signal: ctl.signal,
      });
      const data = (await res.json().catch(() => ({}))) as { answer?: string; error?: string; reset?: boolean };
      if (ctl.signal.aborted) return;
      if (data.reset) {
        setMessages([]);
        setError(data.error ?? null);
        return;
      }
      if (res.ok && data.answer) setMessages([...history, { role: "assistant", content: data.answer }]);
      else setError(data.error ?? "Не получилось получить ответ.");
    } catch {
      if (!ctl.signal.aborted) setError("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.");
    } finally {
      if (abort.current === ctl) setPending(false);
    }
  }

  function ask(text: string) {
    const q = text.trim().slice(0, 1000);
    if (!q || pending) return;
    setDraft("");
    void send([...messages, { role: "user", content: q }]);
  }

  if (!configured) {
    return (
      <p className="rounded-2xl bg-surface p-5 text-ink-2 ring-1 ring-hairline">
        Помощник пока не подключён. Расписание, баллы и заявки есть в разделах <Link className="text-brand" href="/schedule">Расписание</Link>,{" "}
        <Link className="text-brand" href="/grades">Учёба</Link> и <Link className="text-brand" href="/requests">Заявки</Link>.
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {messages.length === 0 && (
        <section aria-label="Примеры вопросов" className="mb-6">
          <p className="mb-3 text-body text-ink-2">Спросите обычными словами: помощник ответит по данным вашего кабинета и даст ссылку на нужный экран.</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => ask(s)}
                  className="flex min-h-12 w-full items-center gap-2.5 rounded-2xl bg-surface px-4 py-2.5 text-left text-body ring-1 ring-hairline transition hover:bg-fill/70 active:scale-[0.99]"
                >
                  <Sparkles aria-hidden className="size-4 shrink-0 text-brand" />
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div role="log" aria-label="Разговор" className="space-y-3">
        {messages.map((m, i) =>
          m.role === "user" ? (
            <p key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand-fill px-4 py-2.5 text-body break-words text-on-brand">
              {m.content}
            </p>
          ) : (
            <div key={i} className="mr-auto max-w-[92%] rounded-2xl rounded-bl-md bg-surface px-4 py-3 text-body break-words ring-1 ring-hairline">
              <Answer text={m.content} />
            </div>
          ),
        )}
        {pending && (
          <p role="status" className="mr-auto flex w-fit items-center gap-2 rounded-2xl rounded-bl-md bg-surface px-4 py-3 text-sm text-ink-2 ring-1 ring-hairline">
            <span aria-hidden className="flex gap-1">
              {[0, 1, 2].map((d) => (
                <span key={d} className="size-1.5 animate-pulse rounded-full bg-ink-3 motion-reduce:animate-none" style={{ animationDelay: `${d * 150}ms` }} />
              ))}
            </span>
            Смотрю в кабинет…
          </p>
        )}
        {error && (
          <div role="alert" className="rounded-2xl bg-bad-soft px-4 py-3 text-sm text-bad">
            <p>{error}</p>
            {messages.at(-1)?.role === "user" && (
              <button type="button" onClick={() => send(messages)} className="mt-1 inline-flex min-h-11 items-center gap-1.5 font-semibold">
                <RotateCcw aria-hidden className="size-4" />
                Повторить
              </button>
            )}
          </div>
        )}
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
        className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 mt-5 flex items-end gap-2 rounded-3xl bg-surface p-2 ring-1 ring-field focus-within:ring-2 focus-within:ring-focus md:bottom-4"
      >
        <label htmlFor="ask" className="sr-only">
          Ваш вопрос
        </label>
        <textarea
          id="ask"
          rows={1}
          value={draft}
          maxLength={1000}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              ask(draft);
            }
          }}
          placeholder="Спросите про пары, баллы, заявки…"
          className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-body outline-none [field-sizing:content] placeholder:text-ink-3"
        />
        <button
          type="submit"
          aria-label="Отправить вопрос"
          disabled={pending || !draft.trim()}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-fill text-on-brand transition active:scale-90 disabled:bg-fill disabled:text-ink-3"
        >
          <ArrowUp aria-hidden className="size-5" />
        </button>
      </form>
    </div>
  );
}
