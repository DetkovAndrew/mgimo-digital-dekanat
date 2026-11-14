import { LifeBuoy, Users, Wifi } from "lucide-react";
import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { Disclosure, PageTitle, Section } from "@/components/ui";
import { formatDateTime, formatTime } from "@/lib/format";
import { WIFI_COOLDOWN_MIN, WIFI_RADIUS_DOMAIN, wifiQrSource } from "@/lib/services/wifi";
import { RefreshAt } from "@/components/refresh-at";
import { getMyWifi } from "@/server/dal/wifi";
import { CopyButton, RotateButton, SecretValue } from "./wifi-parts";

// Wi-Fi кампуса (docs/plans/services.md): личная сеть с паролем, гостевая с кодом дня и QR. Демо: сети вымышлены.

export const dynamic = "force-dynamic";

const DEVICES: { name: string; steps: string[] }[] = [
  {
    name: "Android",
    steps: [
      "Откройте настройки Wi-Fi и выберите сеть University.",
      "Метод EAP: PEAP. Фаза 2: MSCHAPV2.",
      `Сертификат ЦС: «Использовать системные сертификаты», домен: ${WIFI_RADIUS_DOMAIN}.`,
      "Пользователь: ваш логин, пароль: пароль Wi-Fi с этой страницы.",
    ],
  },
  {
    name: "iPhone и iPad",
    steps: [
      "Откройте настройки Wi-Fi и выберите сеть University.",
      "Введите логин и пароль Wi-Fi.",
      `Проверьте, что сертификат выдан для ${WIFI_RADIUS_DOMAIN}, и нажмите «Доверять».`,
    ],
  },
  {
    name: "Windows",
    steps: [
      "Нажмите значок сети на панели задач и выберите University.",
      "Введите логин и пароль Wi-Fi.",
      `Если Windows спросит о сертификате, сверьте имя сервера ${WIFI_RADIUS_DOMAIN} и нажмите «Подключиться».`,
    ],
  },
  {
    name: "macOS",
    steps: [
      "Откройте меню Wi-Fi в строке меню и выберите University.",
      "Введите логин и пароль Wi-Fi, режим оставьте автоматическим.",
      `Проверьте сертификат ${WIFI_RADIUS_DOMAIN} и нажмите «Продолжить».`,
    ],
  },
];

export default async function WifiPage() {
  const w = await getMyWifi();
  const now = new Date();
  const cooling = w.nextRotationAt && w.nextRotationAt > now;

  return (
    <>
      <BackLink href="/services">Сервисы</BackLink>
      {/* Кнопка смены пароля и код гостевой сети меняются по времени: страница обновится сама. */}
      <RefreshAt at={[w.nextRotationAt?.toISOString() ?? null, w.guest.validUntil.toISOString()]} />
      <PageTitle sub="Сети работают в обоих корпусах. Демо: сети и пароли вымышлены.">Wi-Fi</PageTitle>

      <section aria-labelledby="wifi-main" className="mb-7 rounded-3xl bg-surface p-5 ring-1 ring-hairline">
        <div className="mb-4 flex items-center gap-3">
          <span aria-hidden className="grid size-11 place-items-center rounded-xl bg-info-soft text-info">
            <Wifi className="size-6" />
          </span>
          <div>
            <h2 id="wifi-main" className="text-title leading-tight font-bold">
              {w.ssid}
            </h2>
            <p className="text-sm text-ink-2">Личная сеть студентов · WPA2-Enterprise</p>
          </div>
        </div>
        <dl className="divide-y divide-hairline rounded-2xl bg-page ring-1 ring-hairline">
          <div className="pt-2 pr-1 pb-1 pl-4">
            <dt className="text-xs text-ink-2">Логин</dt>
            <dd className="flex min-w-0 items-center">
              <span className="min-w-0 flex-1 truncate font-mono text-body">{w.login}</span>
              <CopyButton value={w.login} label="Логин" />
            </dd>
          </div>
          <div className="pt-2 pr-1 pb-1 pl-4">
            <dt className="text-xs text-ink-2">Пароль</dt>
            <dd className="min-w-0">
              <SecretValue value={w.password} />
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-ink-2">
          Пароль Wi-Fi отдельный от пароля кабинета. Если он попал к другим, смените его: старый перестанет работать.
          {w.rotatedAt && ` Последняя смена: ${formatDateTime(w.rotatedAt)}.`}
        </p>
        <div className="mt-3">
          {cooling ? (
            <p className="text-sm text-ink-3">
              Сменить снова можно в {formatTime(w.nextRotationAt!)} (не чаще раза в {WIFI_COOLDOWN_MIN} минут).
            </p>
          ) : (
            <RotateButton />
          )}
        </div>
      </section>

      <Section title="Гостевая сеть">
        <div className="flex flex-col gap-4 rounded-2xl bg-surface p-4 ring-1 ring-hairline sm:flex-row sm:items-center">
          {/* QR всегда чёрный на белом: так его читает любая камера и в тёмной теме. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={wifiQrSource(w.guest.qr)} alt={`QR для подключения к сети ${w.guest.ssid}`} width={168} height={168} className="mx-auto size-42 shrink-0 rounded-xl sm:mx-0" />
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold">
              <Users aria-hidden className="size-4 text-ink-2" />
              {w.guest.ssid}
            </p>
            <p className="mt-1 flex items-center">
              <span className="font-mono text-title tracking-wider">{w.guest.code}</span>
              <CopyButton value={w.guest.code} label="Код гостевой сети" />
            </p>
            <p className="text-sm text-ink-2">
              Код на сегодня, действует до {formatTime(new Date(w.guest.validUntil.getTime() - 60_000))}. Покажите QR гостю: камера телефона сама предложит подключиться.
            </p>
          </div>
        </div>
      </Section>

      <Disclosure title="Как подключиться к University">
        <div className="space-y-3">
          {DEVICES.map((d) => (
            <section key={d.name} className="rounded-2xl bg-surface p-4 ring-1 ring-hairline">
              <h3 className="mb-2 font-semibold">{d.name}</h3>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2 marker:text-ink-3">
                {d.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </section>
          ))}
          <p className="px-1 text-xs text-ink-3">Проверку сертификата не отключайте: так пароль не уйдёт поддельной точке доступа.</p>
        </div>
      </Disclosure>

      <Link
        href="/requests/new?type=it_support&topic=wifi"
        transitionTypes={["nav-forward"]}
        className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-hairline transition-colors md:hover:bg-fill/60"
      >
        <LifeBuoy aria-hidden className="size-5 shrink-0 text-info" />
        <span className="min-w-0 flex-1">
          <span className="block font-medium">Не подключается?</span>
          <span className="block text-sm text-ink-2">Заявка в IT-поддержку, тема уже выбрана</span>
        </span>
      </Link>
    </>
  );
}
