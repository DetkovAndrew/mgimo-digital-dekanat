"use client";

import { FileText, FileUp, LoaderCircle, Minus, Plus, Sparkles } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "@/components/toast";
import { countPdfPages, PRINT_RULES, printCost } from "@/lib/services/print";
import { createPrintJobAction } from "../actions";

type FileInfo = { name: string; detected: number | null; note: string };

const option = "flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-surface px-3 text-sm ring-1 ring-hairline transition-colors has-[:checked]:bg-brand-soft has-[:checked]:font-semibold has-[:checked]:ring-2 has-[:checked]:ring-brand has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus";

/**
 * Новое задание печати. Файл читается только в браузере, чтобы узнать число страниц: на сервер уходят имя файла
 * и параметры (в демо печатается задание, а не документ). Стоимость пересчитывает сервер.
 */
export function PrintForm({ left }: { left: number }) {
  const [file, setFile] = useState<FileInfo | null>(null);
  const [pages, setPages] = useState("");
  const [copies, setCopies] = useState(1);
  const [color, setColor] = useState(false);
  const [duplex, setDuplex] = useState(true);
  const [reading, setReading] = useState(false);
  const [pending, run] = useTransition();
  // Номер последнего выбора файла: позднее чтение старого файла не перезапишет новый (ревью Codex 48).
  const pickSeq = useRef(0);

  const n = Number(pages);
  const valid = file && Number.isInteger(n) && n >= 1 && n <= PRINT_RULES.maxPages;
  const cost = valid ? printCost(n, copies, color) : 0;
  const over = cost > left;

  async function pick(f: File | undefined) {
    if (!f) return;
    const seq = ++pickSeq.current;
    setPages("");
    if (f.size > PRINT_RULES.maxFileBytes) {
      setFile({ name: f.name, detected: null, note: "Файл больше 20 МБ: укажите число страниц сами." });
      setReading(false);
      return;
    }
    setFile(null);
    setReading(true);
    let info: FileInfo;
    try {
      const detected = countPdfPages(new Uint8Array(await f.arrayBuffer()));
      info = { name: f.name, detected, note: detected ? `Посчитали страницы: ${detected}. Проверьте число.` : "Не удалось посчитать страницы: укажите сами." };
    } catch {
      info = { name: f.name, detected: null, note: "Не удалось прочитать файл: укажите число страниц сами." };
    }
    if (seq !== pickSeq.current) return;
    setFile(info);
    setPages(info.detected ? String(Math.min(info.detected, PRINT_RULES.maxPages)) : "");
    setReading(false);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid || over || reading) return;
        run(async () => {
          const r = await createPrintJobAction({ fileName: file.name, pages: n, copies, color, duplex });
          toast(r.ok, r.ok ? r.message : r.error);
          if (r.ok) {
            setFile(null);
            setPages("");
            setCopies(1);
          }
        });
      }}
      className="space-y-4 rounded-2xl bg-surface p-4 ring-1 ring-hairline"
    >
      <div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-soft px-4 text-sm font-semibold text-brand has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus">
            {reading ? <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : <FileUp aria-hidden className="size-4" />}
            {file ? "Другой файл" : "Выбрать PDF"}
            <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          </label>
          {!file && (
            <button
              type="button"
              onClick={() => {
                pickSeq.current++;
                setReading(false);
                setFile({ name: "Конспект лекций (пример).pdf", detected: 12, note: "Пример для проверки: 12 страниц." });
                setPages("12");
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-ink-2 ring-1 ring-hairline hover:bg-fill"
            >
              <Sparkles aria-hidden className="size-4" />
              Попробовать на примере
            </button>
          )}
        </div>
        {file ? (
          <p className="mt-2 flex items-start gap-2 text-sm">
            <FileText aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-3" />
            <span className="min-w-0">
              <span className="block font-medium break-words">{file.name}</span>
              <span className="block text-ink-2" aria-live="polite">
                {file.note}
              </span>
            </span>
          </p>
        ) : (
          <p className="mt-2 text-xs text-ink-3">Файл не покидает устройство: в демо печатается задание, а не документ.</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Страниц</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={PRINT_RULES.maxPages}
            value={pages}
            onChange={(e) => setPages(e.target.value)}
            disabled={!file}
            className="min-h-11 w-full rounded-xl border border-field bg-surface px-3 text-body outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-60"
          />
        </label>
        <div className="text-sm">
          <span id="copies-label" className="mb-1 block font-medium">
            Копий
          </span>
          <div role="group" aria-labelledby="copies-label" className="flex min-h-11 items-center justify-between rounded-xl ring-1 ring-field">
            <button type="button" aria-label="Меньше копий" disabled={copies <= 1} onClick={() => setCopies((c) => c - 1)} className="grid size-11 place-items-center rounded-xl text-ink-2 disabled:opacity-40">
              <Minus aria-hidden className="size-4" />
            </button>
            <output aria-live="polite" className="font-semibold tabular-nums">
              {copies}
            </output>
            <button type="button" aria-label="Больше копий" disabled={copies >= PRINT_RULES.maxCopies} onClick={() => setCopies((c) => c + 1)} className="grid size-11 place-items-center rounded-xl text-ink-2 disabled:opacity-40">
              <Plus aria-hidden className="size-4" />
            </button>
          </div>
        </div>
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Печать</legend>
        <div className="grid grid-cols-2 gap-2">
          <label className={option}>
            <input type="radio" name="color" checked={!color} onChange={() => setColor(false)} className="sr-only" />
            Чёрно-белая
          </label>
          <label className={option}>
            <input type="radio" name="color" checked={color} onChange={() => setColor(true)} className="sr-only" />
            Цветная, ×{PRINT_RULES.colorFactor}
          </label>
        </div>
      </fieldset>

      <label className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm">
        <span className="font-medium">С двух сторон</span>
        <input type="checkbox" role="switch" checked={duplex} onChange={(e) => setDuplex(e.target.checked)} className="size-5 accent-brand-fill" />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3">
        <p className="text-sm" aria-live="polite">
          {valid ? (
            over ? (
              <span className="text-bad">
                Нужно {cost} стр., осталось {left}
              </span>
            ) : (
              <>
                Спишется <b>{cost}</b> стр., останется {left - cost}
              </>
            )
          ) : (
            <span className="text-ink-2">Выберите файл и число страниц</span>
          )}
        </p>
        <button
          type="submit"
          disabled={!valid || over || pending || reading}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-fill px-5 font-semibold text-on-brand disabled:bg-fill disabled:text-ink-3"
        >
          {pending && <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />}
          В очередь
        </button>
      </div>
    </form>
  );
}
