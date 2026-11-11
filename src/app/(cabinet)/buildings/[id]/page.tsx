import { Map as MapIcon, Navigation } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { Empty, List, PageTitle, RowLink, Section } from "@/components/ui";
import { formatDay, formatTime, lessonKindLabel } from "@/lib/format";
import { yandexPointUrl, yandexRouteUrl } from "@/lib/geo";
import { BUILDING_SCHEDULE_DAYS, getBuilding } from "@/server/dal/buildings";

const button = "flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition active:scale-[0.98]";

export default async function BuildingPage({ params }: PageProps<"/buildings/[id]">) {
  const { id } = await params;
  const b = await getBuilding(id);

  return (
    <>
      <BackLink href="/schedule">Расписание</BackLink>
      <PageTitle sub={`${b.address}${b.metro ? ` · м. ${b.metro}` : ""}`}>{b.title}</PageTitle>
      <div className="mb-6 flex gap-2">
        <a href={yandexRouteUrl(b, "mt")} target="_blank" rel="noopener noreferrer" className={`${button} bg-brand text-white shadow-sm shadow-brand/30`}>
          <Navigation aria-hidden className="size-4" />
          Маршрут
        </a>
        <a href={yandexPointUrl(b)} target="_blank" rel="noopener noreferrer" className={`${button} bg-white text-brand ring-1 ring-black/[0.06]`}>
          <MapIcon aria-hidden className="size-4" />
          На карте
        </a>
      </div>

      <Section title={`Ваши занятия здесь · ${BUILDING_SCHEDULE_DAYS} дней`}>
        {b.visits.length ? (
          <List>
            {b.visits.map((v) => (
              <RowLink key={v.key} href={v.href}>
                <span className={v.cancelled ? "line-through opacity-60" : ""}>
                  <span className="block font-medium">{v.title}</span>
                  <span className="block text-sm text-slate-500 first-letter:uppercase">
                    {formatDay(v.startsAt)}, {formatTime(v.startsAt)}–{formatTime(v.endsAt)}
                    {v.room && ` · ${v.room}`}
                  </span>
                  <span className="block text-xs text-slate-400">{lessonKindLabel[v.kind]}</span>
                </span>
              </RowLink>
            ))}
          </List>
        ) : (
          <Empty>В ближайшие дни у вас здесь занятий нет.</Empty>
        )}
      </Section>
    </>
  );
}
