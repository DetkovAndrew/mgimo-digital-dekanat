import { MAX_POINTS, SCALE } from "@/lib/grading";

const TICKS = SCALE.filter((b) => b.from > 0).map((b) => b.from); // 91, 84, 75, 68, 60

/** Полоса 0–100: набрано (сплошная), ещё можно набрать (штриховка), пороги шкалы. */
export function PointsBar({ earned, remaining }: { earned: number; remaining: number }) {
  const pct = (n: number) => `${Math.min(100, (n / MAX_POINTS) * 100)}%`;
  // Цвет — только порог 60: «оранжевый» посреди семестра пугал при нормальном темпе.
  const color = earned >= 60 ? "bg-ok" : "bg-brand-fill";
  return (
    <div
      className="relative h-2.5 w-full overflow-hidden rounded-full bg-fill"
      role="img"
      aria-label={`Набрано ${earned} из ${MAX_POINTS}, ещё можно набрать ${remaining}`}
    >
      <div
        className="absolute inset-y-0 bg-[repeating-linear-gradient(45deg,var(--color-hairline)_0_3px,transparent_3px_6px)]"
        style={{ left: pct(earned), width: pct(remaining) }}
      />
      <div className={`absolute inset-y-0 left-0 rounded-full ${color}`} style={{ width: pct(earned) }} />
      {TICKS.map((t) => (
        <span
          key={t}
          className={`absolute inset-y-0 w-px ${t === 60 ? "bg-ink-3" : "bg-hairline"}`}
          style={{ left: pct(t) }}
        />
      ))}
    </div>
  );
}
