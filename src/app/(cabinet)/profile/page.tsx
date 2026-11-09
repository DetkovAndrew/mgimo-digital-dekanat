import { SignOut } from "@/components/nav";
import { Card, PageTitle } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { getMyProfile } from "@/server/dal/profile";

export default async function ProfilePage() {
  const p = await getMyProfile();
  const rows: [string, string][] = [
    ["Факультет", p.faculty],
    ["Направление", p.program],
    ["Профиль", p.programProfile ?? "—"],
    ["Курс", `${p.course}, ${p.level}`],
    ["Группа", p.group],
    ["Форма обучения", `${p.studyForm}, ${p.funding}`],
    ["Номер зачётной книжки", p.recordBookNumber],
    ["Дата зачисления", formatDate(p.enrolledAt)],
    ["Логин", p.login ?? "—"],
  ];

  return (
    <>
      <PageTitle>Профиль</PageTitle>
      <Card>
        <h2 className="mb-3 text-lg font-semibold">{p.fullName}</h2>
        <dl className="divide-y divide-slate-100">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 py-2 text-sm">
              <dt className="text-slate-500">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <SignOut className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm text-red-600 ring-1 ring-black/5 md:hidden" />
    </>
  );
}
