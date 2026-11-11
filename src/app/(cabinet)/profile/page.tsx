import { SignOut } from "@/components/nav";
import { List } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { getMyProfile } from "@/server/dal/profile";

export default async function ProfilePage() {
  const p = await getMyProfile();
  const [last, first] = p.fullName.split(" ");
  const initials = `${first?.[0] ?? ""}${last?.[0] ?? ""}`; // «Лебедева Алина» → «АЛ»
  const main: [string, string][] = [
    ["Факультет", p.faculty],
    ["Направление", p.program],
    ["Курс", `${p.course}, ${p.level}`],
    ["Группа", p.group],
  ];
  const more: [string, string][] = [
    ["Профиль", p.programProfile ?? "—"],
    ["Форма обучения", `${p.studyForm}, ${p.funding}`],
    ["Зачётная книжка", p.recordBookNumber],
    ["Зачислен(а)", formatDate(p.enrolledAt)],
    ["Логин", p.login ?? "—"],
  ];
  const rows = (xs: [string, string][]) =>
    xs.map(([k, v]) => (
      <li key={k} className="flex min-h-12 items-baseline justify-between gap-4 px-4 py-2.5 text-sm">
        <span className="shrink-0 text-slate-500">{k}</span>
        <span className="text-right">{v}</span>
      </li>
    ));

  return (
    <>
      <div className="mb-6 flex flex-col items-center pt-2 text-center">
        <span aria-hidden className="mb-3 grid size-20 place-items-center rounded-full bg-gradient-to-br from-brand to-indigo-500 text-2xl font-bold text-white shadow-lg shadow-brand/25">
          {initials}
        </span>
        <h1 className="text-[22px] leading-tight font-bold tracking-tight">{p.fullName}</h1>
        <p className="text-sm text-slate-500">
          {p.group} · {p.course} курс
        </p>
      </div>
      <div className="mb-4">
        <List>{rows(main)}</List>
      </div>
      <details className="mb-6">
        <summary className="flex min-h-11 cursor-pointer list-none items-center px-1 text-[13px] font-semibold tracking-wide text-slate-500 uppercase">
          Подробнее ›
        </summary>
        <List>{rows(more)}</List>
      </details>
      <SignOut className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-medium text-red-600 ring-1 ring-black/[0.04] transition active:scale-[0.98] md:hidden" />
    </>
  );
}
