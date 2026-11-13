"use client";

import { ArrowUp, CalendarCheck, LoaderCircle, RotateCcw, Sparkles, SquarePen, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { bookFromAssistantAction } from "@/app/(cabinet)/rooms/actions";
import { parseInline } from "@/lib/assistant/answer";
import type { BookingProposal } from "@/server/dal/rooms";
import { ASKED_KEY, writeLocal } from "./local-store";
import { MascotFigure, MascotIcon } from "./mascots";
import { authClient } from "@/lib/auth-client";

// Помощник GigaChat — кружок в углу любого экрана кабинета. Живёт в layout: разговор не теряется при переходах,
// ссылка из ответа закрывает окно и открывает экран. Отдельного раздела нет.

const OPEN_EVENT = "assistant:open";
/** Открыть помощника из любого места (кнопка на «Сегодня»). */
export const openAssistant = () => window.dispatchEvent(new Event(OPEN_EVENT));

/** proposal — карточка брони, которую подготовил сервер по просьбе студента (в историю для модели не уходит). */
type Msg = { role: "user" | "assistant"; content: string; proposal?: BookingProposal };

const SUGGESTIONS = [
  "Что у меня завтра и где?",
  "Сколько баллов не хватает до зачёта?",
  "Когда можно на физкультуру и есть ли места?",
  "Как заказать справку для военкомата?",
];

/** Ответ помощника: строки, пункты списка, жирный и ссылки на экраны кабинета. HTML не отрисовывается. */
function Answer({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  const lines = text.split("\n").filter((l) => l.trim());
  const inline = (line: string) =>
    parseInline(line).map((x, i) =>
      x.kind === "link" ? (
        <Link key={i} href={x.href} onClick={onNavigate} transitionTypes={["nav-forward"]} className="font-medium break-words text-brand underline decoration-brand/40 underline-offset-2">
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

/**
 * Карточка брони от Инвиктуса: что, где, когда, для чего. Бронь создаёт только нажатие «Забронировать» —
 * обычная серверная бронь с сессией, проверкой правил и блокировками (как на схеме корпуса).
 */
function BookingCard({ proposal: p, owner, onNavigate }: { proposal: BookingProposal; owner: string; onNavigate: () => void }) {
  const [state, setState] = useState<"ready" | "done" | "dismissed">("ready");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const date = new Intl.DateTimeFormat("ru-RU", { timeZone: "Europe/Moscow", weekday: "short", day: "numeric", month: "long" }).format(new Date(`${p.day}T12:00:00+03:00`));
  if (state === "dismissed") return <p className="mt-2 text-sm text-ink-2">Бронь не оформлена.</p>;
  return (
    <div className="mt-3 rounded-2xl bg-surface p-3 ring-1 ring-hairline">
      <p className="flex items-center gap-2 font-semibold">
        <CalendarCheck aria-hidden className="size-4 text-brand" />
        {p.number} · {p.name}
      </p>
      <p className="mt-0.5 text-sm text-ink-2">
        {p.building}, {p.capacity} мест · {date}, с {p.start} до {p.end}
      </p>
      <p className="text-sm text-ink-2">Цель: {p.purpose}</p>
      {state === "done" ? (
        <p role="status" className="mt-2 flex flex-wrap items-center gap-x-2 rounded-xl bg-ok-soft px-3 py-2 text-sm text-ok">
          Забронировано.
          <Link href="/rooms" onClick={onNavigate} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2">
            Мои брони
          </Link>
        </p>
      ) : (
        <>
          {error && (
            <p role="alert" className="mt-2 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">
              {error}
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await bookFromAssistantAction(owner, { roomId: p.roomId, day: p.day, start: p.start, minutes: p.minutes, purpose: p.purpose }).catch(() => ({ ok: false as const, error: "Нет связи с сервером. Попробуйте ещё раз." }));
                  if (r.ok) setState("done");
                  else setError(r.error);
                })
              }
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-fill px-4 text-sm font-semibold text-on-brand transition active:scale-[0.98] disabled:bg-fill disabled:text-ink-3"
            >
              {pending && <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />}
              Забронировать
            </button>
            <button type="button" disabled={pending} onClick={() => setState("dismissed")} className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-medium text-ink-2 ring-1 ring-hairline">
              Не нужно
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const MAX_BODY_BYTES = 20 * 1024; // сервер принимает до 24 КиБ

/** Последние реплики, которые помещаются в лимит тела запроса: старые пары уходят первыми. */
function fit(owner: string, full: Msg[]) {
  // Модели — только роль и текст: карточки броней остаются в браузере.
  const history = full.map(({ role, content }) => ({ role, content }));
  let h = history.slice(-12);
  const size = (m: Msg[]) => new TextEncoder().encode(JSON.stringify({ owner, messages: m })).length;
  while (h.length > 1 && (size(h) > MAX_BODY_BYTES || h[0].role !== "user")) h = h.slice(1);
  return h;
}

function Chat({ configured, owner, onClose }: { configured: boolean; owner: string; onClose: () => void }) {
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
    writeLocal(ASKED_KEY, "1"); // пасхалка: вопрос Инвиктусу открывает попутчика Искорку
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, messages: fit(owner, history) }),
        signal: ctl.signal,
      });
      const data = (await res.json().catch(() => ({}))) as { answer?: string; error?: string; reset?: boolean; proposal?: BookingProposal };
      if (ctl.signal.aborted) return;
      if (data.reset) {
        setMessages([]);
        setError(data.error ?? null);
        return;
      }
      if (res.ok && data.answer) setMessages([...history, { role: "assistant", content: data.answer, ...(data.proposal ? { proposal: data.proposal } : {}) }]);
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

  function restart() {
    abort.current?.abort();
    setMessages([]);
    setPending(false);
    setError(null);
  }

  return (
    <div className="flex h-full flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] md:p-0">
      <header className="flex items-center gap-3 border-b border-hairline py-2 pr-2 pl-4">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft">
          <MascotIcon id="invictus" size={34} />
        </span>
        <span className="min-w-0 flex-1">
          <h2 id="assistant-title" className="font-semibold">
            Инвиктус
          </h2>
          <p className="truncate text-xs text-ink-2">Помощник на GigaChat · может ошибаться, сверяйтесь с разделами</p>
        </span>
        {messages.length > 0 && (
          <button type="button" onClick={restart} aria-label="Новый разговор" className="grid size-11 place-items-center rounded-full text-ink-2 transition-colors hover:bg-fill">
            <SquarePen aria-hidden className="size-5" />
          </button>
        )}
        <button type="button" onClick={onClose} aria-label="Закрыть помощника" className="grid size-11 place-items-center rounded-full text-ink-2 transition-colors hover:bg-fill">
          <X aria-hidden className="size-5" />
        </button>
      </header>

      {!configured ? (
        <p className="m-4 rounded-2xl bg-page p-4 text-ink-2">
          Помощник пока не подключён. Расписание, баллы и заявки есть в разделах{" "}
          <Link className="text-brand" href="/schedule" onClick={onClose}>
            Расписание
          </Link>
          ,{" "}
          <Link className="text-brand" href="/grades" onClick={onClose}>
            Учёба
          </Link>{" "}
          и{" "}
          <Link className="text-brand" href="/requests" onClick={onClose}>
            Заявки
          </Link>
          .
        </p>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            {messages.length === 0 && (
              <section aria-label="Примеры вопросов">
                <p className="mb-3 text-body text-ink-2">Спросите обычными словами: Инвиктус ответит по данным вашего кабинета и даст ссылку на нужный экран.</p>
                <ul className="grid gap-2">
                  {SUGGESTIONS.map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => ask(s)}
                        className="flex min-h-12 w-full items-center gap-2.5 rounded-2xl bg-page px-4 py-2.5 text-left text-body transition hover:bg-fill active:scale-[0.99]"
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
                  <div key={i} className="mr-auto max-w-[92%] rounded-2xl rounded-bl-md bg-page px-4 py-3 text-body break-words">
                    <Answer text={m.content} onNavigate={onClose} />
                    {m.proposal && <BookingCard proposal={m.proposal} owner={owner} onNavigate={onClose} />}
                  </div>
                ),
              )}
              {pending && (
                <p role="status" className="mr-auto flex w-fit items-center gap-2 rounded-2xl rounded-bl-md bg-page py-2 pr-4 pl-2 text-sm text-ink-2">
                  {/* Инвиктус думает: переминается и моргает (без анимации при prefers-reduced-motion). */}
                  <svg aria-hidden width={30} height={30} viewBox="-16 -18 32 32" className="shrink-0 overflow-visible">
                    <g className="mascot-idle">
                      <MascotFigure id="invictus" />
                    </g>
                  </svg>
                  Инвиктус смотрит в кабинет…
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
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
            className="m-3 mt-0 flex items-end gap-2 rounded-3xl bg-surface p-1.5 ring-1 ring-field focus-within:ring-2 focus-within:ring-focus"
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
              className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-body outline-none [field-sizing:content] placeholder:text-ink-3"
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
        </>
      )}
    </div>
  );
}

/** Кружок в углу и окно помощника: на телефоне на весь экран, на десктопе — панель справа внизу. */
export function Assistant({ configured, owner }: { configured: boolean; owner: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const fab = useRef<HTMLButtonElement>(null);
  const star = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const close = () => dialog.current?.close();
  // Layout переживает переходы, поэтому сессию сверяем сами: если в другой вкладке вошли под другим аккаунтом
  // или вышли, разговор прежнего владельца не показываем, а перезагружаем страницу (сервер отрисует нужного студента).
  const ownerChanged = async () => {
    const { data, error } = await authClient.getSession().catch(() => ({ data: null, error: true }));
    if (error) return false; // нет связи: окно откроется, а запрос отклонит сам сервер
    return data?.user.id !== owner;
  };
  const show = async () => {
    if (await ownerChanged()) {
      close();
      window.location.reload();
      return;
    }
    if (!dialog.current?.open) dialog.current?.showModal();
    setOpen(true);
  };

  // Звёздочка следит за курсором, когда он рядом с кнопкой: сдвиг до 7 px и лёгкий наклон в его сторону.
  // Только мышь и только без prefers-reduced-motion; стиль меняется напрямую, без перерисовки React.
  useEffect(() => {
    const motion = window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)");
    if (!motion.matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const btn = fab.current?.getBoundingClientRect();
        if (!btn || !star.current) return;
        const dx = e.clientX - (btn.left + btn.width / 2);
        const dy = e.clientY - (btn.top + btn.height / 2);
        const dist = Math.hypot(dx, dy);
        const pull = Math.max(0, 1 - dist / 260); // ближе 260 px — тянется, дальше — на месте
        const k = dist ? (7 * Math.min(1, dist / 40) * pull) / dist : 0; // у самого центра сдвиг плавно гаснет
        star.current.style.transform = `translate(${dx * k}px, ${dy * k}px) rotate(${Math.max(-1, Math.min(1, dx / 80)) * 20 * pull}deg) scale(${1 + 0.12 * pull})`;
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  useEffect(() => {
    const onOpen = () => void show();
    const onVisible = () => {
      if (document.visibilityState === "visible") void ownerChanged().then((changed) => changed && window.location.reload());
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      document.removeEventListener("visibilitychange", onVisible);
    };
  });

  return (
    <>
      <button
        type="button"
        ref={fab}
        onClick={() => void show()}
        data-assistant-fab
        aria-label="Спросить Инвиктуса, помощника по кабинету"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 grid size-14 place-items-center rounded-full bg-brand-fill text-on-brand ring-4 ring-page transition duration-200 hover:scale-105 active:scale-95 motion-reduce:transition-none md:right-6 md:bottom-6 ${open ? "pointer-events-none scale-75 opacity-0" : ""}`}
      >
        <span ref={star} aria-hidden className="block transition-transform duration-300 ease-(--ease-out)">
          <Sparkles className="size-6" />
        </span>
      </button>
      <dialog
        ref={dialog}
        aria-labelledby="assistant-title"
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === e.currentTarget && close()}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-surface text-ink opacity-0 transition-[opacity,translate,display,overlay] transition-discrete duration-200 backdrop:bg-ink/25 open:translate-y-0 open:opacity-100 motion-reduce:transition-none starting:open:translate-y-4 starting:open:opacity-0 md:inset-auto md:right-6 md:bottom-6 md:h-[min(40rem,calc(100dvh-3rem))] md:w-[26rem] md:rounded-3xl md:ring-1 md:ring-hairline md:backdrop:bg-ink/10"
      >
        {/* key: при смене аккаунта разговор пересоздаётся, история прежнего пользователя исчезает. */}
        <Chat key={owner} owner={owner} configured={configured} onClose={close} />
      </dialog>
    </>
  );
}

/** Строка «Спросить по кабинету…» на «Сегодня»: открывает то же окно, что и кружок. */
export function AskBar({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openAssistant}
      aria-haspopup="dialog"
      className={`flex min-h-13 w-full items-center gap-3 rounded-2xl bg-surface px-4 text-left text-body text-ink-2 ring-1 ring-hairline transition hover:bg-fill/70 active:scale-[0.99] ${className}`}
    >
      <Sparkles aria-hidden className="size-5 shrink-0 text-brand" />
      <span className="flex-1">Спросить по кабинету…</span>
      <span className="text-xs text-ink-3">GigaChat</span>
    </button>
  );
}
