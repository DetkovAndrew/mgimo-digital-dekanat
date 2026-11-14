"use client";

import { LoaderCircle, Printer as PrinterIcon, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "@/components/toast";
import { buildingTitle, PRINTERS, printerProblem } from "@/lib/campus/printers";
import { cancelPrintJobAction, releasePrintJobAction } from "../actions";

/**
 * Действия с заданием в очереди. В жизни код вводят на экране принтера; в демо принтер выбирают здесь,
 * и сервер проверяет то же, что проверил бы принтер: срок, бумагу, цвет.
 */
export function JobActions({ id, color }: { id: string; color: boolean }) {
  const [choosing, setChoosing] = useState(false);
  const [printer, setPrinter] = useState<string | null>(null);
  const [pending, run] = useTransition();

  const act = (fn: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) =>
    run(async () => {
      const r = await fn();
      toast(r.ok, r.ok ? r.message : r.error);
    });

  if (!choosing)
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setChoosing(true)}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-fill px-4 text-sm font-semibold text-on-brand"
        >
          <PrinterIcon aria-hidden className="size-4" />Я у принтера
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => act(() => cancelPrintJobAction(id))}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium text-bad ring-1 ring-hairline hover:bg-bad-soft disabled:opacity-60"
        >
          {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : <X aria-hidden className="size-4" />}
          Отменить
        </button>
      </div>
    );

  return (
    <fieldset className="mt-3" disabled={pending}>
      <legend className="mb-2 text-sm font-medium">У какого принтера вы стоите?</legend>
      <div className="space-y-2">
        {PRINTERS.map((p) => {
          const problem = printerProblem(p, { color });
          return (
            <label
              key={p.id}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-sm ring-1 ring-hairline has-[:checked]:bg-brand-soft has-[:checked]:ring-2 has-[:checked]:ring-brand has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${problem ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <input type="radio" name={`printer-${id}`} value={p.id} disabled={!!problem} checked={printer === p.id} onChange={() => setPrinter(p.id)} className="size-4 shrink-0 accent-brand-fill" />
              <span className="min-w-0">
                <span className="block font-medium">{p.title}</span>
                <span className="block text-ink-2">
                  {buildingTitle(p.buildingId)}, ауд. {p.room}
                  {problem && `. ${problem}`}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!printer || pending}
          onClick={() => printer && act(() => releasePrintJobAction(id, printer))}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-fill px-4 text-sm font-semibold text-on-brand disabled:bg-fill disabled:text-ink-3"
        >
          {pending ? <LoaderCircle aria-hidden className="size-4 animate-spin motion-reduce:animate-none" /> : <PrinterIcon aria-hidden className="size-4" />}
          Напечатать здесь
        </button>
        <button type="button" onClick={() => setChoosing(false)} className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-medium text-ink-2 hover:bg-fill">
          Назад
        </button>
      </div>
    </fieldset>
  );
}
