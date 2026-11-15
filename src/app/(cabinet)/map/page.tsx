import { Building2, ChevronRight, DoorOpen } from "lucide-react";
import Link from "next/link";
import { PageTitle, Section } from "@/components/ui";
import { PLANS, roomIndexOf } from "@/lib/campus/plans";
import { listCampus } from "@/server/dal/rooms";
import { RoomSearch } from "./room-search";

// «Карта»: найти аудиторию по номеру или названию и открыть её на схеме корпуса (там же расписание, бронь и маршрут).
// Схемы — открытые справочники кампуса для вошедших студентов (AGENTS.md); личного здесь нет.

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const campus = await listCampus();
  const index = PLANS.flatMap(roomIndexOf);

  return (
    <>
      <PageTitle sub="Найдите аудиторию по номеру или названию: схема этажа, расписание и как пройти">Карта</PageTitle>
      <RoomSearch index={index}>
        <Section title="Корпуса">
          <ul className="grid gap-3 sm:grid-cols-2">
            {campus.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/rooms/${c.id}`}
                  transitionTypes={["nav-forward"]}
                  className="group flex h-full flex-col rounded-3xl bg-surface p-4 ring-1 ring-hairline transition hover:bg-fill/50 active:scale-[0.99]"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="grid size-12 place-items-center rounded-2xl bg-brand-fill text-lead font-bold text-on-brand">{c.short}</span>
                    <ChevronRight aria-hidden className="size-5 text-ink-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                  <span className="mt-3 block text-lead font-semibold">{c.name}</span>
                  <span className="block text-sm text-ink-2">
                    {c.address}
                    {c.metro && ` · м. ${c.metro}`}
                  </span>
                  <span className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
                    <span className="flex items-center gap-1">
                      <Building2 aria-hidden className="size-3.5" />
                      {c.wings > 1 ? `${c.wings} крыла · ` : ""}
                      {c.floors.length} этажа
                    </span>
                    <span className="flex items-center gap-1">
                      <DoorOpen aria-hidden className="size-3.5" />
                      можно забронировать: {c.bookable}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </RoomSearch>
    </>
  );
}
