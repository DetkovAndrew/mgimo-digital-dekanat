"use client";

export default function StaffError({ reset }: { reset: () => void }) {
  return <div role="alert" className="rounded-2xl bg-surface p-4 ring-1 ring-hairline">
    <p className="mb-3 text-body">Не удалось загрузить кабинет. Попробуйте ещё раз.</p>
    <button type="button" onClick={reset} className="inline-flex min-h-11 items-center rounded-xl bg-brand-fill px-4 text-body font-semibold text-on-brand">Повторить</button>
  </div>;
}
