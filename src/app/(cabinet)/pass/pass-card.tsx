"use client";

import { ArrowLeft, LoaderCircle, RefreshCw, ShieldCheck, WifiOff } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { isPassCode, PASS_WINDOW_MS, type PassCode } from "@/lib/pass/code";
import { PASS_QR_SIZE, passQrSource } from "@/lib/pass/qr";
import type { PassPageData } from "@/server/dal/pass";

export function PassCard({ owner, avatar, profile }: PassPageData) {
  const session = authClient.useSession();
  const ownsPage = !session.isPending && session.data?.user.id === owner;
  const [code, setCode] = useState<PassCode | null>(null);
  const [now, setNow] = useState(0);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!ownsPage) return;
    let active = true;
    let busy = false;
    let failed = false;
    let current: PassCode | null = null;
    let offset = 0;
    let earlyFor: string | null = null;
    let controller: AbortController | null = null;

    async function refresh() {
      if (!active || busy) return;
      busy = true;
      setPending(true);
      setError(null);
      failed = false;
      try {
        // Предварительный запрос за 2 с ещё может вернуть прежнее окно. На границе запрашиваем снова.
        for (let attempt = 0; attempt < 2; attempt++) {
          controller = new AbortController();
          const timeout = setTimeout(() => controller?.abort(), 8_000);
          try {
            const sent = Date.now();
            const res = await fetch("/api/pass", { cache: "no-store", credentials: "same-origin", headers: { "X-Pass-Owner": owner }, signal: controller.signal });
            if (!active) return;
            if ([401, 403, 409].includes(res.status)) {
              current = null;
              setCode(null);
              setDenied(true);
              failed = true;
              return;
            }
            if (!res.ok) throw new Error("unavailable");
            const data: unknown = await res.json();
            if (!active) return;
            if (!isPassCode(data)) throw new Error("invalid code");
            const serverTime = Number(res.headers.get("X-Pass-Time"));
            // Считаем по часам сервера. Полный RTT даёт небольшой запас: QR скрывается чуть раньше, а не позже срока.
            offset = serverTime > 0 && Number.isFinite(serverTime) ? serverTime - sent : 0;
            const clock = Date.now() + offset;
            if (Date.parse(data.expiresAt) <= clock) {
              if (attempt === 0) continue;
              throw new Error("expired code");
            }
            current = data;
            setCode(data);
            setNow(clock);
            return;
          } finally {
            clearTimeout(timeout);
          }
        }
      } catch {
        if (active) {
          failed = true;
          setError("Нет свежего кода. Проверьте соединение и попробуйте ещё раз.");
        }
      } finally {
        busy = false;
        if (active) setPending(false);
      }
    }

    const tick = () => {
      if (!active) return;
      const clock = Date.now() + offset;
      setNow(clock);
      if (!current || failed || document.visibilityState === "hidden") return;
      const left = Date.parse(current.expiresAt) - clock;
      if (left <= 0) {
        // busy защищает от параллельных запросов. Если задержка/поправка часов вернула старое окно,
        // следующий тик повторит запрос: нельзя навсегда остановиться на истёкшем expiresAt.
        void refresh();
      } else if (left > 0 && left <= 2_000 && earlyFor !== current.expiresAt) {
        earlyFor = current.expiresAt;
        void refresh();
      }
    };
    const resume = () => {
      if (document.visibilityState !== "hidden") {
        tick();
        void refresh();
      }
    };
    void refresh();
    const interval = setInterval(tick, 250);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", resume);
    return () => {
      active = false;
      controller?.abort();
      clearInterval(interval);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", resume);
    };
  }, [owner, ownsPage, retry]);

  const expires = code ? Date.parse(code.expiresAt) : 0;
  const valid = ownsPage && !denied && !error && !!code && now < expires;
  const seconds = valid ? Math.max(0, Math.ceil((expires - now) / 1_000)) : 0;
  const qr = useMemo(() => code ? passQrSource(code.payload) : null, [code]);
  const [last, first] = profile.fullName.trim().split(/\s+/);
  const initials = `${first?.[0] ?? ""}${last?.[0] ?? ""}`;

  return (
    // Компенсируем часть большого общего отступа layout; оставшиеся 96 px защищают нижнюю навигацию.
    <section className="-mb-20 md:mb-0" aria-labelledby="pass-title">
      <header className="mb-2 flex min-h-11 items-center gap-2">
        <Link href="/today" transitionTypes={["nav-back"]} aria-label="Назад: сегодня" className="grid size-11 shrink-0 place-items-center rounded-xl text-ink-2 hover:bg-fill">
          <ArrowLeft aria-hidden className="size-5" />
        </Link>
        <h1 id="pass-title" className="text-title font-semibold tracking-tight">Электронный пропуск</h1>
      </header>

      {!ownsPage || denied ? (
        <div className="rounded-3xl bg-surface p-4 ring-1 ring-hairline">
          {session.isPending && !denied ? (
            <p role="status" className="flex min-h-56 items-center justify-center gap-2 text-body text-ink-2">
              <LoaderCircle aria-hidden className="size-5 motion-safe:animate-spin" /> Загрузка пропуска…
            </p>
          ) : (
            <div role="status" className="py-6 text-body">
              <p>Сессия изменилась. Откройте кабинет заново.</p>
              <Link href="/today" className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-brand-fill px-4 font-semibold text-on-brand">Открыть кабинет</Link>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-3xl bg-surface p-3 ring-1 ring-hairline">
          <div className="flex items-center gap-3">
            <div aria-hidden className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand-soft text-lead font-semibold text-brand">
              {avatar && !photoFailed ? (
                // eslint-disable-next-line @next/next/no-img-element -- Личное фото отдаётся без кеша, next/image запрещён правилами проекта.
                <img src={avatar} alt="" width={48} height={48} onError={() => setPhotoFailed(true)} className="size-full object-cover" />
              ) : initials}
            </div>
            <div className="min-w-0">
              <p className="text-body leading-snug font-semibold wrap-break-word">{profile.fullName}</p>
              <p className="mt-0.5 text-micro text-ink-2">Группа {profile.group} · зачётная книжка № {profile.recordBookNumber}</p>
            </div>
          </div>

          <div className="mx-auto mt-3 grid size-[222px] place-items-center" aria-busy={pending && !valid}>
            {valid && qr ? (
              // eslint-disable-next-line @next/next/no-img-element -- Локальный SVG QR с белым фоном и тихой зоной, без сервиса изображений.
              <img src={qr} width={PASS_QR_SIZE} height={PASS_QR_SIZE} alt="QR-код демонстрационного пропуска" className="block" />
            ) : error ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <WifiOff aria-hidden className="size-6 text-ink-2" />
                <p role="status" className="text-body text-ink-2">{error}</p>
                <button type="button" onClick={() => setRetry((n) => n + 1)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-fill px-4 text-body font-semibold text-on-brand">
                  <RefreshCw aria-hidden className="size-4" /> Обновить
                </button>
              </div>
            ) : (
              <p role="status" className="flex items-center gap-2 text-body text-ink-2">
                <LoaderCircle aria-hidden className="size-5 motion-safe:animate-spin" /> Обновляем код…
              </p>
            )}
          </div>

          <div className="mx-auto mt-3 max-w-64">
            <p className="text-center text-body text-ink-2">{valid ? <>Сменится через <span className="font-semibold text-ink tabular-nums">{seconds} с</span></> : "Код временно недоступен"}</p>
            <div role="progressbar" aria-label="Осталось времени действия кода" aria-valuemin={0} aria-valuemax={30} aria-valuenow={seconds} aria-valuetext={`${seconds} секунд`} className="mt-1.5 h-1 overflow-hidden rounded-full bg-fill">
              <div className="h-full bg-brand-fill motion-safe:transition-[width] motion-safe:duration-200 motion-safe:ease-linear" style={{ width: `${valid ? Math.min(100, (expires - now) / PASS_WINDOW_MS * 100) : 0}%` }} />
            </div>
          </div>

          <p className="mt-3 flex items-start justify-center gap-1.5 text-center text-body leading-snug text-ink-2">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>Демо-пропуск для конкурса.<br />Не открывает турникеты.</span>
          </p>
        </div>
      )}
    </section>
  );
}
