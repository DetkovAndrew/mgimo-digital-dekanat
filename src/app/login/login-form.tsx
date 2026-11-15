"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [shown, setShown] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setPending(true);
    setError(null);
    // Вход через HTTP-эндпоинт Better Auth — на нём действует ограничение попыток.
    const { error } = await authClient.signIn.username({
      username: String(form.get("username") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });
    if (error) {
      setPending(false);
      setError(error.status === 429 ? "Слишком много попыток. Подождите минуту." : "Неверный логин или пароль.");
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Логин</span>
        <input
          name="username"
          required
          autoComplete="username"
          autoCapitalize="none"
          className="w-full rounded-xl border border-field px-3 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </label>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Пароль
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={shown ? "text" : "password"}
            required
            autoComplete="current-password"
            className="w-full rounded-xl border border-field py-3 pr-12 pl-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
          {/* Кнопка вне label: нажатие не фокусирует поле и не открывает клавиатуру на телефоне. */}
          <button
            type="button"
            onClick={() => setShown((v) => !v)}
            aria-label={shown ? "Скрыть пароль" : "Показать пароль"}
            aria-pressed={shown}
            className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-ink-2 hover:text-ink"
          >
            {shown ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}
      <button
        disabled={pending}
        className="w-full rounded-xl bg-brand-fill px-4 py-3 font-medium text-on-brand transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Входим…" : "Войти"}
      </button>
    </form>
  );
}
