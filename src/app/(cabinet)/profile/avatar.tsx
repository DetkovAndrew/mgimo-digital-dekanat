"use client";

import { Camera, LoaderCircle, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { AvatarImg } from "@/components/nav";
import { removeAvatarAction, uploadAvatarAction } from "./actions";

// Фото профиля: обрезаем по центру в квадрат и сжимаем в браузере, на сервер уходит 256×256 (docs/plans/avatars.md).
const SIDE = 256;
const MAX_BYTES = 200 * 1024;
const MAX_SOURCE_BYTES = 25 * 1024 * 1024; // больше не декодируем: телефон может не справиться

async function squeeze(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIDE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIDE, SIDE);
  bmp.close();
  // WebP, если браузер умеет его сохранять; иначе JPEG (toBlob молча отдаёт PNG при неизвестном типе).
  for (const type of ["image/webp", "image/jpeg"]) {
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, 0.86));
    if (blob && blob.type === type && blob.size <= MAX_BYTES) return blob;
  }
  throw new Error("encode");
}

export function AvatarEditor({ src, initials }: { src: string | null; initials: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    start(async () => {
      if (file.size > MAX_SOURCE_BYTES) return setError("Файл слишком большой. Выберите фото до 25 МБ.");
      let blob: Blob;
      try {
        blob = await squeeze(file);
      } catch {
        return setError("Не получилось открыть фото. Выберите JPG или PNG.");
      }
      const form = new FormData();
      form.set("avatar", blob, blob.type === "image/webp" ? "avatar.webp" : "avatar.jpg");
      const r = await uploadAvatarAction(form).catch(() => ({ ok: false as const, error: "Нет связи с сервером. Попробуйте ещё раз." }));
      if (!r.ok) setError(r.error);
    });
  }

  function remove() {
    setError(null);
    start(async () => {
      const r = await removeAvatarAction().catch(() => ({ ok: false as const, error: "Нет связи с сервером. Попробуйте ещё раз." }));
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <div className="mb-3 flex flex-col items-center">
      <div className="relative">
        {src ? (
          <AvatarImg src={src} className="size-24 ring-1 ring-hairline" />
        ) : (
          <span aria-hidden className="grid size-24 place-items-center rounded-full bg-brand-soft text-title font-bold text-brand">
            {initials}
          </span>
        )}
        {pending && (
          <span className="absolute inset-0 grid place-items-center rounded-full bg-surface/70" role="status" aria-label="Сохраняю фото">
            <LoaderCircle aria-hidden className="size-6 animate-spin text-brand motion-reduce:animate-none" />
          </span>
        )}
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={pending}
          aria-label={src ? "Изменить фото" : "Добавить фото"}
          className="absolute -right-1 -bottom-1 grid size-11 place-items-center rounded-full bg-brand-fill text-on-brand ring-4 ring-page transition active:scale-95 disabled:opacity-60"
        >
          <Camera aria-hidden className="size-5" />
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = ""; // то же фото можно выбрать ещё раз
        }}
      />
      <p className="mt-2 text-xs text-ink-3">Фото видно только вам</p>
      {src && (
        <button type="button" onClick={remove} disabled={pending} className="inline-flex min-h-11 items-center gap-1.5 px-2 text-sm text-ink-2 hover:text-bad disabled:opacity-60">
          <Trash2 aria-hidden className="size-4" />
          Удалить фото
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
