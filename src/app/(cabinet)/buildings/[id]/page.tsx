import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { Card, Empty } from "@/components/ui";
import { formatDay, formatTime, lessonKindLabel } from "@/lib/format";
import { yandexPointUrl, yandexRouteUrl } from "@/lib/geo";
import { BUILDING_SCHEDULE_DAYS, getBuilding } from "@/server/dal/buildings";

export default async function BuildingPage({ params }: PageProps<"/buildings/[id]">) {
  const { id } = await params;
  const b = await getBuilding(id);

  return (
    <>
      <BackLink href="/schedule">Расписание</BackLink>
      <h1 className="text-2xl font-semibold leading-tight tracking-tight">{b.title}</h1>
      <p className="mt-1 text-slate-700">{b.address}</p>
      {b.metro && <p className="text-sm text-slate-500">м. {b.metro}</p>}
      <div className="mt-3 mb-6 flex flex-wrap gap-2">
        <a
          href={yandexRouteUrl(b, "mt")}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-semibold text-white"
        >
          Маршрут
        </a>
        <a
          href={yandexPointUrl(b)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-medium text-brand ring-1 ring-brand/30"
        >
          На карте
        </a>
      </div>

      <h2 className="mb-2 font-semibold">Ваши занятия здесь на {BUILDING_SCHEDULE_DAYS} дней</h2>
      {b.visits.length ? (
        <Card className="!py-1">
          <ul className="divide-y divide-slate-100">
            {b.visits.map((v) => (
              <li key={v.key}>
                <Link href={v.href} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
                  <span className={v.cancelled ? "line-through opacity-70" : ""}>
                    <span className="block font-medium">{v.title}</span>
                    <span className="block text-xs text-slate-500">
                      {formatDay(v.startsAt)}, {formatTime(v.startsAt)}–{formatTime(v.endsAt)}
                      {v.room && ` · ${v.room}`} · {lessonKindLabel[v.kind]}
                    </span>
                  </span>
                  <span className="text-slate-300">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <Empty>В ближайшие дни у вас здесь занятий нет.</Empty>
      )}
    </>
  );
}
