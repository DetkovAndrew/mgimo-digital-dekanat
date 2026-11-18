import type { Metadata } from "next";
import Link from "next/link";
import { Disclaimer } from "@/components/disclaimer";
import { addDays, formatDay, formatShortDate, formatTime, lessonKindLabel, mskDayKey, mskWeekStart } from "@/lib/format";
import { getMyStudyEvents, getMyTerm } from "@/server/dal/grades";
import { getMyProfile } from "@/server/dal/profile";
import { getMySchedule } from "@/server/dal/schedule";
import { PrintButton } from "./print-button";

// Расписание на печать (docs/plans/calendar.md): неделя или сессия одним листом A4, без меню кабинета.
// Те же функции DAL, что у расписания: владелец — из сессии. Дисклеймер — и на листе.

export const metadata: Metadata = { title: "Расписание на печать · University" };

const KIND: Record<string, string> = { EXAM: "Экзамен", CREDIT: "Зачёт", GRADED_CREDIT: "Зачёт с оценкой", MIDTERM: "Контрольная", ASSIGNMENT: "Срок сдачи" };

type Row = { at: Date; time: string; title: string; detail: string; note?: string };

export default async function PrintSchedulePage({ searchParams }: PageProps<"/print/schedule">) {
  const session = (await searchParams).range === "session";
  const [profile, term] = await Promise.all([getMyProfile(), getMyTerm()]);
  const now = new Date();
  const range = session && term
    ? { from: new Date(`${term.sessionStartsOn.toISOString().slice(0, 10)}T00:00:00+03:00`), to: addDays(new Date(`${term.sessionEndsOn.toISOString().slice(0, 10)}T00:00:00+03:00`), 1) }
    : { from: mskWeekStart(now), to: addDays(mskWeekStart(now), 7) };
  const [lessons, events] = await Promise.all([getMySchedule(range), getMyStudyEvents(range)]);

  const rows: Row[] = [
    // Сессия — только консультации и аттестации; неделя — все занятия и тренировки.
    ...lessons
      .filter((l) => !session || l.kind === "CONSULTATION")
      .map((l) => ({
        at: l.startsAt,
        time: `${formatTime(l.startsAt)}–${formatTime(l.endsAt)}`,
        title: `${l.title}${l.status === "CANCELLED" ? " — отменено" : ""}`,
        detail: [lessonKindLabel[l.kind] ?? "Занятие", l.online ? "онлайн" : [l.room, l.building?.title].filter(Boolean).join(", "), l.teacher].filter(Boolean).join(" · "),
        note: l.status === "RESCHEDULED" ? "изменено" : undefined,
      })),
    ...events
      .filter((e) => !session || !e.deadline)
      .map((e) => ({
        at: e.at,
        time: e.deadline ? `до ${formatTime(e.at)}` : formatTime(e.at),
        title: `${KIND[e.kind] ?? "Работа"}: ${e.discipline}`,
        detail: [e.deadline ? e.title : null, e.room].filter(Boolean).join(" · "),
      })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  const days = Map.groupBy(rows, (r) => mskDayKey(r.at));
  const heading = session ? `Сессия: ${term ? `${formatShortDate(range.from)} — ${formatShortDate(addDays(range.to, -1))}` : "даты не опубликованы"}` : `Неделя ${formatShortDate(range.from)} — ${formatShortDate(addDays(range.to, -1))}`;

  return (
    <div className="min-h-full bg-page print:bg-white">
      <div className="print:hidden">
        <Disclaimer />
      </div>
      <main className="mx-auto max-w-3xl px-4 py-6 print:max-w-none print:p-0">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/schedule/export" className="inline-flex min-h-11 items-center font-medium text-brand">
            ← Календарь и печать
          </Link>
          <PrintButton />
        </div>
        <header className="mb-4 border-b border-hairline pb-3">
          <p className="text-sm text-ink-2">University · {profile.fullName} · группа {profile.group}</p>
          <h1 className="text-title font-bold">{heading}</h1>
        </header>
        {days.size ? (
          [...days].map(([key, list]) => (
            <section key={key} className="mb-4 break-inside-avoid">
              <h2 className="mb-1 text-lead font-semibold first-letter:uppercase">{formatDay(list[0].at)}</h2>
              <table className="w-full border-collapse text-body">
                <tbody>
                  {list.map((r, i) => (
                    <tr key={i} className="border-t border-hairline align-top">
                      <td className="w-32 py-1.5 pr-3 font-medium whitespace-nowrap tabular-nums">{r.time}</td>
                      <td className="py-1.5">
                        <span className="font-medium">{r.title}</span>
                        {r.note && <span className="ml-2 text-sm text-warn">{r.note}</span>}
                        {r.detail && <span className="block text-sm text-ink-2">{r.detail}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))
        ) : (
          <p className="text-body text-ink-2">{session ? "Экзаменов и консультаций в сессию пока нет." : "На этой неделе занятий нет."}</p>
        )}
        <p className="mt-6 text-micro text-ink-2">
          Напечатано {formatShortDate(now)}, {formatTime(now)}. Концепт для конкурса MGIMO AI Challenge 2026. Не является официальным сервисом какого-либо вуза. Все данные вымышлены.
        </p>
      </main>
    </div>
  );
}
