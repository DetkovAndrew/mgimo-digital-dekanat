"use client";

import { CalendarClock, Check, ChevronRight, ClipboardCheck, FileText, Megaphone, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "@/components/toast";
import { Empty, IconTile } from "@/components/ui";
import { hideNotifications, restoreNotifications } from "./actions";

const KIND = {
  ANNOUNCEMENT: { label: "Объявление", icon: Megaphone, tone: "brand" },
  SCHEDULE_CHANGE: { label: "Расписание", icon: CalendarClock, tone: "warn" },
  DEADLINE: { label: "Срок", icon: ClipboardCheck, tone: "info" },
  REQUEST_STATUS: { label: "Заявка", icon: FileText, tone: "ok" },
} as const;

export type NotificationItem = {
  id: string;
  kind: keyof typeof KIND;
  title: string;
  body: string;
  important: boolean;
  when: string;
  read: boolean;
  link: { href: string; label: string } | null;
};

const OFFLINE = "Нет связи с сервером. Попробуйте ещё раз.";

/**
 * Список уведомлений с удалением у себя: смахнуть строку влево (телефон) или «Выбрать» → отметить → «Удалить».
 * Долгое нажатие на строку тоже включает выбор. Свайп с клавиатуры недоступен, поэтому выбор: основной путь, а жест
 * лишь ускоряет его. После удаления строки исчезают сразу, сервер подтверждает; в сообщении есть «Вернуть».
 */
export function NotificationList({ owner, items }: { owner: string; items: NotificationItem[] }) {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const visible = items.filter((n) => !hidden.has(n.id));

  const hideLocal = (ids: string[], on: boolean) =>
    setHidden((h) => {
      const next = new Set(h);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  async function remove(ids: string[]) {
    if (!ids.length) return;
    hideLocal(ids, true);
    setSelecting(false);
    setSelected(new Set());
    const r = await hideNotifications(owner, ids).catch(() => ({ ok: false as const, error: OFFLINE }));
    if (!r.ok) {
      hideLocal(ids, false);
      toast(false, r.error);
      return;
    }
    if (!r.ids.length) return; // уже удалены в другой вкладке
    toast(true, r.ids.length === 1 ? "Уведомление удалено" : `Удалено уведомлений: ${r.ids.length}`, {
      label: "Вернуть",
      run: async () => {
        hideLocal(r.ids, false);
        const back = await restoreNotifications(owner, r.ids, r.at).catch(() => null);
        if (!back?.ok) {
          hideLocal(r.ids, true);
          toast(false, back ? "Не удалось вернуть уведомления" : OFFLINE);
        }
      },
    });
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (!visible.length) return <Empty art="notifications">Уведомлений пока нет.</Empty>;

  const all = visible.every((n) => selected.has(n.id));
  return (
    <>
      <div className="sticky top-13 z-10 -mx-1 mb-2 flex min-h-12 items-center gap-1 bg-page/90 px-1 backdrop-blur-md md:top-0">
        {selecting ? (
          <>
            <button type="button" onClick={() => (setSelecting(false), setSelected(new Set()))} className="min-h-11 rounded-xl px-3 text-sm font-medium text-ink-2 hover:bg-fill">
              Отмена
            </button>
            {/* Число — на кнопке «Удалить»: на 360 px отдельная подпись не помещается. */}
            <span aria-live="polite" className="sr-only">
              Выбрано: {selected.size}
            </span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => setSelected(all ? new Set() : new Set(visible.map((n) => n.id)))}
              className="min-h-11 rounded-xl px-3 text-sm font-medium whitespace-nowrap text-brand hover:bg-brand-soft"
            >
              {all ? "Снять выбор" : "Выбрать все"}
            </button>
            <button
              type="button"
              disabled={!selected.size}
              onClick={() => remove([...selected])}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-bad-fill px-3 text-sm font-semibold whitespace-nowrap text-on-brand transition active:scale-95 disabled:opacity-40"
            >
              {/* На 360 px «Удалить · 100» с иконкой не помещается рядом с «Отмена» и «Выбрать все» (ревью Codex 92). */}
              <Trash2 aria-hidden className="hidden size-4 min-[400px]:block" />
              Удалить
              {selected.size > 0 && <span className="tabular-nums">· {selected.size}</span>}
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 text-xs text-ink-3 md:hidden">Смахните влево, чтобы удалить</span>
            <button type="button" onClick={() => setSelecting(true)} className="ml-auto min-h-11 rounded-xl px-3 text-sm font-medium text-brand hover:bg-brand-soft">
              Выбрать
            </button>
          </>
        )}
      </div>
      <ul className="overflow-hidden rounded-2xl bg-surface ring-1 ring-hairline">
        {visible.map((n) => (
          <SwipeRow
            key={n.id}
            disabled={selecting}
            onDelete={() => remove([n.id])}
            onLongPress={() => {
              setSelecting(true);
              setSelected(new Set([n.id]));
            }}
          >
            {selecting ? (
              <label className="flex cursor-pointer gap-3 px-4 py-3">
                <input type="checkbox" checked={selected.has(n.id)} onChange={() => toggle(n.id)} className="peer sr-only" />
                <span
                  aria-hidden
                  className={`mt-2 grid size-6 shrink-0 place-items-center rounded-full ring-2 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus ${
                    selected.has(n.id) ? "bg-brand-fill text-on-brand ring-brand-fill" : "ring-field"
                  }`}
                >
                  {selected.has(n.id) && <Check className="size-4" strokeWidth={3} />}
                </span>
                <Body n={n} />
              </label>
            ) : (
              <div className="flex gap-3 px-4 py-3">
                <Body n={n} />
              </div>
            )}
          </SwipeRow>
        ))}
      </ul>
    </>
  );
}

function Body({ n }: { n: NotificationItem }) {
  const k = KIND[n.kind];
  return (
    <>
      <IconTile icon={k.icon} tone={n.important ? "warn" : k.tone} />
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-1.5 text-xs text-ink-3">
          {!n.read && (
            <>
              <span aria-hidden className="size-2 shrink-0 rounded-full bg-brand-fill" />
              <span className="sr-only">Новое.</span>
            </>
          )}
          {k.label} · {n.when}
        </div>
        <h2 className={`leading-snug ${n.read ? "font-medium" : "font-semibold"}`}>{n.title}</h2>
        <p className="mt-0.5 text-sm text-ink-2">{n.body}</p>
        {n.link && (
          <Link href={n.link.href} transitionTypes={["nav-forward"]} className="mt-1 inline-flex min-h-11 items-center gap-0.5 text-sm font-medium text-brand">
            {n.link.label}
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        )}
      </div>
    </>
  );
}

const LONG_PRESS = 500;

/**
 * Строка со свайпом влево (только касание и перо: мышью выделяют текст). Вертикальное движение означает прокрутку,
 * жест отменяется; дальше 40 % ширины строка удаляется, иначе возвращается. Долгое нажатие без движения включает выбор.
 * После жеста или долгого нажатия клик по ссылке в строке подавляется (ревью Codex 90).
 */
function SwipeRow({ children, disabled, onDelete, onLongPress }: { children: React.ReactNode; disabled: boolean; onDelete: () => void; onLongPress: () => void }) {
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const g = useRef<{ x: number; y: number; id: number; swiping: boolean; timer: number } | null>(null);
  const suppress = useRef(false);

  const reset = () => {
    if (g.current) clearTimeout(g.current.timer);
    g.current = null;
    setDx(0);
    setDragging(false);
  };

  return (
    <li className="relative border-b border-hairline last:border-b-0">
      <div aria-hidden className={`absolute inset-0 flex items-center justify-end gap-2 bg-bad-fill pr-5 text-sm font-semibold text-on-brand ${dx || leaving ? "" : "invisible"}`}>
        <Trash2 className="size-5" />
        Удалить
      </div>
      <div
        style={{ transform: dx || leaving ? `translateX(${leaving ? "-100%" : `${dx}px`})` : undefined }}
        className={`relative touch-pan-y bg-surface [-webkit-touch-callout:none] ${dragging ? "" : "transition-transform duration-200 ease-(--ease-out) motion-reduce:transition-none"}`}
        onPointerDown={(e) => {
          if (disabled || e.pointerType === "mouse" || leaving) return;
          suppress.current = false;
          const id = e.pointerId;
          const timer = window.setTimeout(() => {
            if (g.current?.id !== id || g.current.swiping) return;
            suppress.current = true;
            g.current = null;
            navigator.vibrate?.(10);
            onLongPress();
          }, LONG_PRESS);
          g.current = { x: e.clientX, y: e.clientY, id, swiping: false, timer };
        }}
        onPointerMove={(e) => {
          const s = g.current;
          if (!s || s.id !== e.pointerId) return;
          const mx = e.clientX - s.x;
          const my = e.clientY - s.y;
          if (!s.swiping) {
            if (Math.abs(mx) < 8 && Math.abs(my) < 8) return;
            clearTimeout(s.timer);
            if (Math.abs(my) >= Math.abs(mx) || mx > 0) {
              g.current = null; // прокрутка или свайп вправо: строку не двигаем
              return;
            }
            s.swiping = true;
            setDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          setDx(Math.min(0, mx));
        }}
        onPointerUp={(e) => {
          const s = g.current;
          if (!s || s.id !== e.pointerId) return;
          clearTimeout(s.timer);
          if (s.swiping) {
            suppress.current = true;
            const width = e.currentTarget.offsetWidth;
            if (-(e.clientX - s.x) > width * 0.4) {
              g.current = null;
              setDragging(false);
              setLeaving(true);
              const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              window.setTimeout(onDelete, reduce ? 0 : 180);
              return;
            }
          }
          reset();
        }}
        onPointerCancel={reset}
        onClickCapture={(e) => {
          if (!suppress.current) return;
          suppress.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
        onContextMenu={(e) => {
          if (e.nativeEvent instanceof PointerEvent && e.nativeEvent.pointerType !== "mouse") e.preventDefault();
        }}
      >
        {children}
      </div>
    </li>
  );
}
