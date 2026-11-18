import { CalendarArrowDown, CalendarSync, Printer } from "lucide-react";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { Card, PageTitle, Section } from "@/components/ui";
import { getMyFeed } from "@/server/dal/calendar";
import { FeedAddress, RotateFeedButton } from "./feed-parts";

// Календарь и печать (docs/plans/calendar.md): подписка по секретной ссылке, файл .ics и лист для печати.

const button = "flex min-h-12 items-center justify-center gap-2 rounded-xl text-body font-semibold transition active:scale-[0.98]";
const primary = `${button} bg-brand-fill text-on-brand`;
const secondary = `${button} bg-surface text-brand ring-1 ring-hairline`;

export default async function ScheduleExportPage() {
  const feed = await getMyFeed();
  return (
    <>
      <BackLink href="/schedule">Расписание</BackLink>
      <PageTitle sub="Пары, тренировки, экзамены, сроки работ и брони аудиторий: в календарь телефона или на бумагу.">Календарь и печать</PageTitle>

      <Section title="Подписка: календарь обновляется сам">
        <Card>
          <p className="mb-3 text-body text-ink-2">
            Перенесёт деканат пару — изменение придёт в календарь телефона без входа в кабинет. Как часто обновлять подписку, решает сам календарь: обычно раз в час или реже.
          </p>
          {/* webcal:// открывает «Подписаться» в Календаре iPhone и Mac; обычная ссылка — это не страница, а лента. */}
          <a href={feed.webcal} className={primary}>
            <CalendarSync aria-hidden className="size-5" />
            Подписаться в Календаре iPhone
          </a>
          <details className="mt-3 rounded-xl bg-page px-3 py-2 text-body">
            <summary className="flex min-h-11 cursor-pointer items-center font-medium">Google Календарь, Android, Outlook</summary>
            <ol className="mt-1 mb-2 list-decimal space-y-1 pl-5 text-ink-2">
              <li>На компьютере откройте Google Календарь → «Другие календари» → «+» → «Добавить по URL». В приложении на телефоне подписку добавить нельзя, она появится там сама.</li>
              <li>Вставьте адрес ниже. В Outlook: «Добавить календарь» → «Подписаться из Интернета».</li>
            </ol>
            <p className="mb-2 text-sm text-warn">Google получит адрес и ваши события. Новая ссылка отключит доступ, но уже скачанное не удалит.</p>
          </details>
          <p className="mt-3 mb-1 text-sm font-medium">Адрес подписки — как пароль: не пересылайте его</p>
          <FeedAddress url={feed.https} />
          <div className="mt-3">
            <RotateFeedButton />
          </div>
        </Card>
      </Section>

      <Section title="Файл: один раз">
        <Card>
          <p className="mb-3 text-body text-ink-2">Снимок расписания на сегодня. Переносы сами не обновятся: скачайте файл заново или оформите подписку.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <a href="/api/calendar/file?range=week" className={secondary}>
              <CalendarArrowDown aria-hidden className="size-5" />
              Эта неделя
            </a>
            <a href="/api/calendar/file?range=term" className={secondary}>
              <CalendarArrowDown aria-hidden className="size-5" />
              Семестр и сессия
            </a>
          </div>
        </Card>
      </Section>

      <Section title="Печать">
        <Card>
          <p className="mb-3 text-body text-ink-2">Лист A4: на холодильник или в PDF («Печать» → «Сохранить как PDF»; на iPhone — «Поделиться» → «Напечатать»).</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Link href="/print/schedule?range=week" className={secondary}>
              <Printer aria-hidden className="size-5" />
              Неделя
            </Link>
            <Link href="/print/schedule?range=session" className={secondary}>
              <Printer aria-hidden className="size-5" />
              Сессия
            </Link>
          </div>
        </Card>
      </Section>
    </>
  );
}
