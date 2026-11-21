"use client";

import { BellOff, BellRing, LoaderCircle, Send, Smartphone } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { pushStatusAction, pushSubscribeAction, pushTestAction, pushUnsubscribeAction } from "@/app/push-actions";
import { currentPushSubscription, isIosBrowserTab, pushSupported, registerPushWorker, sameKey, urlBase64ToBytes } from "@/lib/push-client";

// Уведомления на телефон (docs/plans/push.md): включаются на каждом устройстве отдельно. owner: для кого открыт экран.
type State = "checking" | "unsupported" | "ios-install" | "denied" | "off" | "on";

const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-body font-semibold transition active:scale-[0.98] disabled:opacity-60";

export function PushToggle({ owner, publicKey }: { owner: string; publicKey: string }) {
  const [state, setState] = useState<State>("checking");
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let alive = true;
    (async () => {
      if (isIosBrowserTab()) return "ios-install" as const;
      if (!pushSupported()) return "unsupported" as const;
      if (Notification.permission === "denied") return "denied" as const;
      // Worker регистрируем заранее: запрос разрешения потом идёт прямо из нажатия (iOS иначе его не покажет).
      const reg = await registerPushWorker();
      let sub = await reg.pushManager.getSubscription();
      // Сменился ключ сервера: старая подписка браузера не подойдёт, пересоздаём при включении.
      if (sub && !sameKey(sub, publicKey)) {
        await sub.unsubscribe().catch(() => undefined);
        sub = null;
      }
      if (!sub) return "off" as const;
      return (await pushStatusAction(owner, sub.endpoint).catch(() => false)) ? ("on" as const) : ("off" as const);
    })()
      .then((s) => alive && setState(s))
      .catch(() => alive && setState("unsupported"));
    return () => {
      alive = false;
    };
  }, [owner, publicKey]);

  function enable() {
    setNote(null);
    start(async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      try {
        // Разрешение спрошено прямо из нажатия; подписываться — только у активного worker (ревью Codex 99).
        await registerPushWorker();
        const reg = await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(publicKey) }));
        const r = await pushSubscribeAction(owner, sub.toJSON());
        setNote(r.message);
        if (r.ok) setState("on");
      } catch {
        setNote("Не получилось включить. Проверьте интернет и попробуйте ещё раз.");
      }
    });
  }

  function disable() {
    setNote(null);
    start(async () => {
      const sub = await currentPushSubscription();
      const r = sub ? await pushUnsubscribeAction(owner, sub.endpoint).catch(() => null) : { ok: true, message: "Уведомления на этом устройстве выключены." };
      // Сервер отказал (сменился аккаунт, нет связи) — браузерную подписку не трогаем.
      if (!r?.ok) return setNote(r?.message ?? "Нет связи с сервером. Попробуйте ещё раз.");
      await sub?.unsubscribe().catch(() => undefined);
      setNote(r.message);
      setState("off");
    });
  }

  function test() {
    setNote(null);
    start(async () => {
      const sub = await currentPushSubscription();
      const r = sub ? await pushTestAction(owner, sub.endpoint).catch(() => null) : null;
      setNote(r?.message ?? "Нет связи с сервером. Попробуйте ещё раз.");
    });
  }

  return (
    <div className="rounded-2xl bg-surface p-4 ring-1 ring-hairline">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
          {state === "on" ? <BellRing className="size-5" /> : state === "ios-install" ? <Smartphone className="size-5" /> : <BellOff className="size-5" />}
        </span>
        <div className="min-w-0 text-sm">
          <p className="text-body font-semibold">{TITLE[state]}</p>
          <p className="mt-0.5 text-ink-2">{TEXT[state]}</p>
        </div>
      </div>
      {(state === "off" || state === "on") && (
        <div className="mt-3 flex flex-wrap gap-2">
          {state === "off" ? (
            <button type="button" onClick={enable} disabled={pending} className={`${btn} flex-1 bg-brand-fill text-on-brand`}>
              {pending ? <LoaderCircle aria-hidden className="size-4.5 animate-spin" /> : <BellRing aria-hidden className="size-4.5" />}
              Включить
            </button>
          ) : (
            <>
              <button type="button" onClick={test} disabled={pending} aria-label="Прислать проверочное уведомление" className={`${btn} flex-1 bg-brand-soft text-brand`}>
                {pending ? <LoaderCircle aria-hidden className="size-4.5 animate-spin" /> : <Send aria-hidden className="size-4.5" />}
                Проверить
              </button>
              <button type="button" onClick={disable} disabled={pending} className={`${btn} text-ink ring-1 ring-hairline`}>
                Выключить
              </button>
            </>
          )}
        </div>
      )}
      <p role="status" className={note ? "mt-3 text-sm text-ink-2" : "sr-only"}>
        {note}
      </p>
    </div>
  );
}

const TITLE: Record<State, string> = {
  checking: "Проверяем браузер",
  unsupported: "Браузер их не поддерживает",
  "ios-install": "Сначала добавьте на экран «Домой»",
  denied: "Запрещены в браузере",
  off: "Выключены",
  on: "Включены на этом устройстве",
};

const TEXT: Record<State, string> = {
  checking: "Смотрим, умеет ли браузер присылать уведомления.",
  unsupported: "Откройте кабинет в Chrome, Edge, Firefox или Safari либо добавьте его на экран «Домой».",
  "ios-install": "На iPhone они приходят только у сайта с экрана «Домой»: «Поделиться» → «На экран „Домой“», затем откройте University с иконки.",
  denied: "Разрешите уведомления для этого сайта в настройках браузера и обновите страницу.",
  off: "Переносы пар, статусы заявок и объявления придут, даже когда кабинет закрыт. На заблокированном экране виден только тип события.",
  on: "Переносы пар, статусы заявок и объявления придут сюда. После выхода из кабинета перестанут.",
};
