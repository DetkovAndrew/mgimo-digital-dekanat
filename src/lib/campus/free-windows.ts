// Свободные окна аудитории на день из слотов брони (начала каждые 30 минут, src/server/dal/rooms.ts): соседние начала
// склеиваются в окно «10:00–12:30». Опрос 15–16.11: по полосе занятости «приходится нажимать… чтобы понять, когда свободно».

const STEP = 30;
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function freeWindows(slots: readonly { start: string }[]): string[] {
  const starts = [...new Set(slots.map((s) => toMin(s.start)))].sort((a, b) => a - b);
  const out: string[] = [];
  let from = -1;
  let last = -1;
  for (const m of starts) {
    if (from < 0) from = m;
    else if (m !== last + STEP) {
      out.push(`${toHHMM(from)}–${toHHMM(last + STEP)}`);
      from = m;
    }
    last = m;
  }
  if (from >= 0) out.push(`${toHHMM(from)}–${toHHMM(last + STEP)}`);
  return out;
}
