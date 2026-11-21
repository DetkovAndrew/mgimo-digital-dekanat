"use client";

import { useEffect } from "react";
import { clearBadge, setBadge } from "@/lib/app-badge";

/** Число на значке приложения = новые уведомления на колокольчике. Работает у сайта с экрана «Домой» на iPhone (после
 * разрешения уведомлений) и у установленного сайта на компьютере; в остальных браузерах вызова нет. */
export function AppBadge({ owner, count }: { owner: string; count: number }) {
  useEffect(() => {
    void setBadge(owner, count);
  }, [owner, count]);
  return null;
}

/** На странице входа: сессия кончилась или вышли — число прежнего аккаунта со значка убираем. */
export function ClearAppBadge() {
  useEffect(() => {
    void clearBadge();
  }, []);
  return null;
}
