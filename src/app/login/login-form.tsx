"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Пароль</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-xl border border-field px-3 py-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </label>
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
