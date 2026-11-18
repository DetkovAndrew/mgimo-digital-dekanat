import { CalendarPlus } from "lucide-react";

// «В календарь» у одного события: обычная ссылка на .ics (не next/link: это файл, а не страница). iPhone открывает
// предпросмотр события с кнопкой «Добавить», Android и компьютер открывают календарь по умолчанию. Владельца проверяет сервер.

type Kind = "lesson" | "assessment" | "sport" | "room";
const href = (kind: Kind, id: string) => `/api/calendar/event?kind=${kind}&id=${encodeURIComponent(id)}`;

/** Кнопка во всю ширину (страница пары). */
export function CalendarButton({ kind, id }: { kind: Kind; id: string }) {
  return (
    <a
      href={href(kind, id)}
      className="mt-2 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-surface text-body font-semibold text-brand ring-1 ring-hairline transition active:scale-[0.98]"
    >
      <CalendarPlus aria-hidden className="size-4" />
      Добавить в календарь
    </a>
  );
}

/** Круглая кнопка 44 px в строке списка (брони, тренировки, сроки). */
export function CalendarIconLink({ kind, id, label }: { kind: Kind; id: string; label: string }) {
  return (
    <a href={href(kind, id)} aria-label={`В календарь: ${label}`} title="Добавить в календарь" className="grid size-11 shrink-0 place-items-center rounded-full text-brand ring-1 ring-hairline transition active:scale-95">
      <CalendarPlus aria-hidden className="size-5" />
    </a>
  );
}
