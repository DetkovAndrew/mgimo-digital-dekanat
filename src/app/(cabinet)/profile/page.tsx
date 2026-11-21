import { SignOut } from "@/components/nav";
import { ThemePicker } from "@/components/theme-picker";
import { Disclosure, List, Section } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { SKINS } from "@/lib/invictia/skins";
import { getMyAvatarUrl } from "@/server/dal/avatar";
import { getPushPublicKey } from "@/server/dal/push";
import { getMyProfile } from "@/server/dal/profile";
import { getMyWardrobe } from "@/server/dal/skins";
import { requireStudent } from "@/server/session";
import { AvatarEditor } from "./avatar";
import { PushToggle } from "./push-toggle";
import { Wardrobe } from "./wardrobe";

export default async function ProfilePage() {
  const [p, avatar, wardrobe, { userId }] = await Promise.all([getMyProfile(), getMyAvatarUrl(), getMyWardrobe(), requireStudent()]);
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
    ["Дата зачисления", formatDate(p.enrolledAt)],
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
        <h1 className="text-title leading-tight font-bold tracking-tight">{p.fullName}</h1>
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
      {/* key: при смене аккаунта состояние прежнего не переносится. */}
      <Section title="Уведомления на телефон">
        <PushToggle key={userId} owner={userId} publicKey={getPushPublicKey()} />
      </Section>
      <Section title="Оформление">
        <ThemePicker />
      </Section>
      {/* Образы открываются за достижения: сессия, физкультура, брони, корпуса (src/lib/invictia/skins.ts). */}
      <Section title="Образ Инвиктии" aside={<span className="text-sm text-ink-2">открыто {wardrobe.unlocked.length} из {SKINS.length}</span>}>
        <Wardrobe current={wardrobe.current} unlocked={wardrobe.unlocked} />
      </Section>
      <SignOut className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-surface text-body font-medium text-bad ring-1 ring-hairline transition active:scale-[0.98] md:hidden" />
    </>
  );
}
