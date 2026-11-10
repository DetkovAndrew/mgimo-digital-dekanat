import { Badge, Card, PageTitle } from "@/components/ui";
import { formatDate, formatDateTime, formatDay, formatTime } from "@/lib/format";
import { getMySport } from "@/server/dal/sport";
import { CancelBookingButton, DemoDrawButton } from "./buttons";
import { PreferencesEditor, type SlotView } from "./preferences-editor";

function Bar({ value, max, mark }: { value: number; max: number; mark?: number }) {
  return (
    <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${value} из ${max}`}>
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${value >= (mark ?? max) ? "bg-emerald-500" : "bg-brand"}`}
        style={{ width: `${Math.min(100, (value / max) * 100)}%` }}
      />
      {mark && <span className="absolute inset-y-0 w-px bg-slate-500" style={{ left: `${(mark / max) * 100}%` }} />}
    </div>
  );
}

export default async function SportPage() {
  const s = await getMySport();
  const p = s.progress;
  const perWeek = p.weeksLeft ? Math.ceil(p.trainingsNeeded / p.weeksLeft) : p.trainingsNeeded;

  const slots: SlotView[] =
    s.open?.slots.map((x) => ({
      id: x.id,
      title: x.section.title,
      day: formatDay(x.startsAt),
      time: `${formatTime(x.startsAt)}–${formatTime(x.endsAt)}`,
      place: `${x.building.title}, ${x.room}`,
      coach: x.coach,
      capacity: x.capacity,
      demand: x.demand,
      unavailable: x.unavailable,
    })) ?? [];

  return (
    <>
      <PageTitle>Физкультура</PageTitle>

      <Card className="mb-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold">{s.term ?? "Семестр"}</h2>
          <p className="text-2xl font-semibold tabular-nums">
            {p.total}
            <span className="text-sm font-normal text-slate-400"> / {s.rules.total}</span>
          </p>
        </div>
        <div className="mt-3 space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span>Тренировки</span>
              <span className="tabular-nums text-slate-600">
                {p.trainingPoints} / {s.rules.trainingMin} обязательных
              </span>
            </div>
            <Bar value={p.trainingPoints} max={s.rules.trainingMin} />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span>Дополнительные баллы</span>
              <span className="tabular-nums text-slate-600">{p.extraPoints} / 40</span>
            </div>
            <Bar value={p.extraPoints} max={40} />
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Посещено {p.attended} {p.missed ? `(пропусков без отмены: ${p.missed}) ` : ""}·{" "}
          {p.trainingsNeeded === 0 ? (
            <b className="text-emerald-700">обязательные тренировки закрыты</b>
          ) : (
            <>
              нужно ещё <b>{p.trainingsNeeded}</b> — осталось недель: {p.weeksLeft}, это ≈ {perWeek} в неделю
            </>
          )}
          .
        </p>
        {p.extra.length > 0 && (
          <p className="mt-1 text-xs text-slate-500">
            {p.extra.map((e) => `${e.title}: +${e.points} (${formatDate(e.awardedAt)})`).join(" · ")}
          </p>
        )}
      </Card>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">Мои ближайшие тренировки</h2>
        {s.upcoming.length ? (
          <ul className="space-y-2">
            {s.upcoming.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5">
                <span className="min-w-0 flex-1 text-sm">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <b>{b.slot.section.title}</b>
                    {b.status === "WAITLIST" ? (
                      <Badge tone="warn">лист ожидания{b.position ? ` · вы ${b.position}-й` : ""}</Badge>
                    ) : b.conflict ? (
                      <Badge tone="bad">конфликт с расписанием</Badge>
                    ) : (
                      <Badge tone="ok">место есть</Badge>
                    )}
                  </span>
                  <span className="block text-slate-600 first-letter:uppercase">
                    {formatDay(b.slot.startsAt)}, {formatTime(b.slot.startsAt)}–{formatTime(b.slot.endsAt)}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {b.slot.building.title}, {b.slot.room} · {b.slot.coach}
                  </span>
                  {b.conflict && (
                    <span className="block text-xs text-red-700">
                      После изменения расписания: {b.conflict}. Отмените запись, чтобы место получил другой.
                    </span>
                  )}
                  {b.explanation && <span className="block text-xs text-slate-500">Почему: {b.explanation}</span>}
                </span>
                <CancelBookingButton id={b.id} waitlist={b.status === "WAITLIST"} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
            Записей пока нет. Выберите тренировки на следующую неделю ниже.
          </p>
        )}
      </section>

      {s.open ? (
        <section className="mb-6">
          <h2 className="font-semibold">
            Запись на неделю с {formatDate(new Date(`${s.open.weekStart.toISOString().slice(0, 10)}T12:00:00+03:00`))}
          </h2>
          <p className="mb-3 text-sm text-slate-500">
            Приоритеты принимаются до {formatDateTime(s.open.deadline)}. Потом — жеребьёвка: сначала каждому по одному
            занятию, затем вторые. Кто подал раньше, не получает преимущества.
          </p>
          <Card>
            <PreferencesEditor
              key={s.open.weekStart.toISOString()}
              weekStart={s.open.weekStart.toISOString().slice(0, 10)}
              slots={slots}
              initial={s.open.myPreferenceSlotIds}
              max={s.rules.maxPreferences}
            />
          </Card>
          {s.demoDrawEnabled && (
            <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
              <p className="mb-2">
                <b>Демо для жюри.</b> В реальности жеребьёвка проходит автоматически после дедлайна. Здесь можно «ускорить
                время»: провести её для ближайшей открытой недели. Конкуренцию создают 36 симулированных участников.
              </p>
              <DemoDrawButton />
            </div>
          )}
        </section>
      ) : (
        <p className="mb-6 text-sm text-slate-500">Открытых для записи недель в этом семестре больше нет.</p>
      )}

      <details className="rounded-2xl bg-white p-4 text-sm ring-1 ring-black/5">
        <summary className="cursor-pointer font-semibold">Как устроена честная запись</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">
          <li>
            Вы заранее отмечаете до {s.rules.maxPreferences} подходящих тренировок в порядке желания. Гонки за местами в
            момент открытия нет.
          </li>
          <li>
            Тренировки, которые пересекаются с вашими парами или до которых не успеть дойти (с учётом 10 минут на
            переодевание), система не предлагает и объясняет почему.
          </li>
          <li>
            После дедлайна — жеребьёвка: случайный порядок студентов, сначала каждому по одному занятию, затем вторые
            (максимум {s.rules.weeklyQuota} в неделю и не больше одной в день).
          </li>
          <li>
            Не хватило мест — вы в листе ожидания. Кто-то отменил запись — место автоматически получает следующий, причём
            сначала тот, у кого ещё нет занятий на неделе.
          </li>
          <li>Отмена до начала возвращает место и квоту. Неявка без отмены тратит квоту.</li>
          <li>Тренировка — {s.rules.pointsPerTraining} баллов, для зачёта нужно 60 за тренировки и 100 всего (правила University, демо).</li>
        </ul>
      </details>
    </>
  );
}
