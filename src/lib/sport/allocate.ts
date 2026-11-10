// Честная запись на физкультуру: жеребьёвка недели в два прохода (правило University, демо).
// Чистая функция без БД: одинаковые входные данные и seed → одинаковый результат.
//
// 1. Порядок студентов — случайная перестановка из seed. Время подачи приоритетов не влияет.
// 2. Проход 1: каждому — самый приоритетный доступный слот со свободными местами (максимум один).
// 3. Проход 2: тем же порядком — следующие занятия до недельной квоты.
// 4. Лист ожидания: неудовлетворённые доступные приоритеты студентов, не добравших квоту,
//    в порядке жеребьёвки (позиция считается отдельно для каждого слота).

export type SlotInput = { id: string; capacity: number; startsAt: Date; endsAt: Date };
export type PreferenceInput = { studentId: string; slotId: string; rank: number };

export type AllocateInput = {
  seed: string;
  slots: SlotInput[];
  preferences: PreferenceInput[];
  weeklyQuota: number;
  /** null — студенту можно на слот; иначе короткая причина («пересечение с парой»). Считается снаружи. */
  unavailableReason: (studentId: string, slotId: string) => string | null;
};

export type Assignment = {
  studentId: string;
  slotId: string;
  rank: number;
  status: "CONFIRMED" | "WAITLIST";
  pass?: 1 | 2;
  position?: number; // место в листе ожидания слота, с 1
  explanation: string;
};

export type AllocateResult = { order: string[]; assignments: Assignment[] };

// ─── Детерминированный генератор случайных чисел ────────────────────────────
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function lotteryOrder(studentIds: string[], seed: string): string[] {
  const order = [...new Set(studentIds)].sort(); // от порядка подачи не зависит
  const random = mulberry32(hashSeed(seed));
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

const mskDay = (d: Date) => new Date(d.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);

export function allocate(input: AllocateInput): AllocateResult {
  const slots = new Map(input.slots.map((s) => [s.id, s]));
  const left = new Map(input.slots.map((s) => [s.id, s.capacity]));
  const prefsByStudent = new Map<string, PreferenceInput[]>();
  for (const p of input.preferences) {
    if (!slots.has(p.slotId)) continue;
    prefsByStudent.set(p.studentId, [...(prefsByStudent.get(p.studentId) ?? []), p]);
  }
  for (const list of prefsByStudent.values()) list.sort((a, b) => a.rank - b.rank);

  const order = lotteryOrder([...prefsByStudent.keys()], input.seed);
  const confirmed = new Map<string, Assignment[]>(order.map((id) => [id, []]));
  const assignments: Assignment[] = [];

  // Второе занятие не в тот же день, что уже выданное, и без пересечения.
  const compatible = (studentId: string, slot: SlotInput) =>
    confirmed.get(studentId)!.every((a) => {
      const other = slots.get(a.slotId)!;
      return mskDay(other.startsAt) !== mskDay(slot.startsAt);
    });

  for (const pass of [1, 2] as const) {
    for (const studentId of order) {
      const mine = confirmed.get(studentId)!;
      if (mine.length >= Math.min(pass, input.weeklyQuota)) continue;
      const skipped: string[] = [];
      for (const p of prefsByStudent.get(studentId)!) {
        if (mine.some((a) => a.slotId === p.slotId)) continue;
        const slot = slots.get(p.slotId)!;
        const reason = input.unavailableReason(studentId, p.slotId);
        if (reason) {
          skipped.push(`${p.rank}-й: ${reason}`);
          continue;
        }
        if (!compatible(studentId, slot)) continue;
        if ((left.get(p.slotId) ?? 0) <= 0) {
          skipped.push(`${p.rank}-й: мест не хватило`);
          continue;
        }
        left.set(p.slotId, left.get(p.slotId)! - 1);
        const a: Assignment = {
          studentId,
          slotId: p.slotId,
          rank: p.rank,
          status: "CONFIRMED",
          pass,
          explanation:
            `${p.rank}-й выбор` + (skipped.length ? ` (${skipped.join(", ")})` : "") + (pass === 2 ? ", второе занятие недели" : ""),
        };
        mine.push(a);
        assignments.push(a);
        break;
      }
    }
  }

  // Лист ожидания: только для тех, кто не добрал квоту, и только реально подходящие слоты.
  const positions = new Map<string, number>();
  for (const studentId of order) {
    const mine = confirmed.get(studentId)!;
    if (mine.length >= input.weeklyQuota) continue;
    for (const p of prefsByStudent.get(studentId)!) {
      if (mine.some((a) => a.slotId === p.slotId)) continue;
      if (input.unavailableReason(studentId, p.slotId)) continue;
      if (!compatible(studentId, slots.get(p.slotId)!)) continue;
      const position = (positions.get(p.slotId) ?? 0) + 1;
      positions.set(p.slotId, position);
      assignments.push({
        studentId,
        slotId: p.slotId,
        rank: p.rank,
        status: "WAITLIST",
        position,
        explanation: `${p.rank}-й выбор: мест не хватило — лист ожидания`,
      });
    }
  }

  return { order, assignments };
}
