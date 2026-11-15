"use client";

import { useSyncExternalStore } from "react";

// Настройки одного браузера (тема): localStorage. Без хранилища (приватный режим) значения живут
// в памяти вкладки. На сервере и при гидрации — значения по умолчанию (useSyncExternalStore, без расхождений).

const memory = new Map<string, string>();
const listeners = new Set<() => void>();

function readLocal(key: string) {
  try {
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

export function writeLocal(key: string, value: string) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // хранилище недоступно: остаётся значение в памяти
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export const useLocal = (key: string, fallback: string) =>
  useSyncExternalStore(
    subscribe,
    () => readLocal(key) ?? fallback,
    () => fallback,
  );
