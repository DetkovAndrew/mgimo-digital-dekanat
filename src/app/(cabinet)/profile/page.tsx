import { SignOut } from "@/components/nav";
import { Disclosure, List } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { getMyAvatarUrl } from "@/server/dal/avatar";
import { getMyProfile } from "@/server/dal/profile";
import { AvatarEditor } from "./avatar";

export default async function ProfilePage() {
  const [p, avatar] = await Promise.all([getMyProfile(), getMyAvatarUrl()]);
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
        <span className="shrink-0 text-ink-2">{k}</span>
        <span className="text-right">{v}</span>
      </li>
    ));

  return (
    <>
      <div className="mb-6 flex flex-col items-center pt-2 text-center">
        <AvatarEditor src={avatar} initials={initials} />
        <h1 className="text-[22px] leading-tight font-bold tracking-tight">{p.fullName}</h1>
        <p className="text-sm text-ink-2">
          {p.group} · {p.course} курс
        </p>
      </div>
      <div className="mb-4">
        <List>{rows(main)}</List>
      </div>
      <Disclosure title="Подробнее">
        <List>{rows(more)}</List>
      </Disclosure>
      <SignOut className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-surface text-[15px] font-medium text-bad ring-1 ring-hairline transition active:scale-[0.98] md:hidden" />
    </>
  );
}
