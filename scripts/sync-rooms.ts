// Аудитории со схем корпусов → таблица room; занятия этих корпусов → lesson.roomId.
// Не разрушает данные: upsert аудиторий и пересчёт ссылок занятий. Вызывается из seed и отдельно:
// `npm run db:rooms` (например, после изменения src/lib/campus/plans.ts на сервере), `-- --demo-bookings` — демо-брони.
import { existsSync } from "node:fs";
import { allPlanRooms, PLANS, roomNumberFrom } from "../src/lib/campus/plans";
import { prisma } from "../src/server/db";

export async function syncRooms() {
  const rooms = allPlanRooms();
  for (const r of rooms) {
    const { id, ...data } = r;
    await prisma.room.upsert({ where: { id }, update: data, create: r });
  }
  const known = new Set(rooms.map((r) => r.id));
  const lessons = await prisma.lesson.findMany({
    where: { buildingId: { in: PLANS.map((p) => p.buildingId) } },
    select: { id: true, buildingId: true, room: true, online: true, roomId: true },
  });
  const byRoom = new Map<string | null, string[]>();
  let unmatched = 0;
  for (const l of lessons) {
    const n = roomNumberFrom(l.room);
    const id = !l.online && n ? `${l.buildingId}-${n}` : null;
    const target = id && known.has(id) ? id : null;
    if (!l.online && l.room && !target) {
      // Аудитории занятия больше нет на схеме: старую связь не трогаем, синхронизация сообщит об ошибке.
      unmatched++;
      continue;
    }
    if (target !== l.roomId) byRoom.set(target, [...(byRoom.get(target) ?? []), l.id]);
  }
  for (const [roomId, ids] of byRoom) await prisma.lesson.updateMany({ where: { id: { in: ids } }, data: { roomId } });
  // Аудитории, которых больше нет на схеме (ревью Codex 20). Сначала закрываем бронирование: bookRoom перечитывает
  // bookable под блокировкой аудитории. Затем каждую удаляем под той же блокировкой и только без занятий и броней,
  // иначе бронь, созданная в этот момент, ушла бы каскадом вместе с аудиторией.
  const stale = await prisma.room.findMany({ where: { buildingId: { in: PLANS.map((p) => p.buildingId) }, id: { notIn: [...known] } }, select: { id: true } });
  await prisma.room.updateMany({ where: { id: { in: stale.map((r) => r.id) } }, data: { bookable: false } });
  let removed = 0;
  for (const { id } of stale) {
    removed += await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "room" WHERE "id" = ${id} FOR UPDATE`;
      const used = (await tx.lesson.count({ where: { roomId: id } })) + (await tx.roomBooking.count({ where: { roomId: id } }));
      if (used) return 0;
      await tx.room.delete({ where: { id } });
      return 1;
    });
  }
  return { rooms: rooms.length, lessonsLinked: lessons.filter((l) => !l.online).length - unmatched, unmatched, removed, staleKept: stale.length - removed };
}

// ─── Брони аудиторий (docs/plans/rooms.md) ───────────────────────────────────
// Вымышленные студенты занимают коворкинги и переговорные на неделю вперёд; у Алины — одна бронь на завтра.
export async function seedRoomBookings(demoLogin: string) {
  if (await prisma.roomBooking.count()) return 0;
  const rooms = await prisma.room.findMany({ where: { bookable: true }, orderBy: { id: "asc" } });
  const sims = await prisma.studentProfile.findMany({ where: { group: { code: "SIM-0000" } }, select: { id: true }, orderBy: { id: "asc" } });
  const alina = await prisma.studentProfile.findFirstOrThrow({ where: { user: { username: demoLogin } } });
  const today = isoDay(new Date());
  const purposes = ["Подготовка к экзамену", "Проектная команда", "Встреча студсовета", "Репетиция доклада", "Хакатон: созвон команды"];
  const starts = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00"];
  const busy = async (roomId: string, from: Date, to: Date) =>
    (await prisma.lesson.count({ where: { roomId, status: { not: "CANCELLED" }, startsAt: { lt: to }, endsAt: { gt: from } } })) +
    (await prisma.roomBooking.count({ where: { roomId, status: "CONFIRMED", startsAt: { lt: to }, endsAt: { gt: from } } }));
  let n = 0;
  for (const [ri, room] of rooms.entries()) {
    for (let d = 0; d < 7; d++) {
      const date = isoDay(addDays(msk(today, "12:00"), d));
      for (const [si, start] of starts.entries()) {
        if ((ri * 7 + d * 3 + si * 5) % (room.kind === "COWORKING" ? 3 : 4) !== 0) continue;
        const from = msk(date, start);
        const to = new Date(from.getTime() + (si % 2 ? 90 : 60) * 60_000);
        if (to <= new Date() || (await busy(room.id, from, to))) continue;
        await prisma.roomBooking.create({
          data: { roomId: room.id, studentId: sims[n++ % sims.length].id, startsAt: from, endsAt: to, purpose: purposes[(ri + d + si) % purposes.length] },
        });
      }
    }
  }
  const atrium = rooms.find((r) => r.kind === "COWORKING")!;
  const tomorrow = isoDay(addDays(msk(today, "12:00"), 1));
  for (const start of ["14:00", "11:00", "19:00"]) {
    const from = msk(tomorrow, start);
    const to = new Date(from.getTime() + 90 * 60_000);
    if (await busy(atrium.id, from, to)) continue;
    await prisma.roomBooking.create({ data: { roomId: atrium.id, studentId: alina.id, startsAt: from, endsAt: to, purpose: "Подготовка к коллоквиуму" } });
    break;
  }
  return prisma.roomBooking.count();
}

const msk = (date: string, time = "00:00") => new Date(`${date}T${time}:00+03:00`);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);
const isoDay = (d: Date) => new Date(d.getTime() + 3 * 3_600_000).toISOString().slice(0, 10);

if (process.argv[1]?.endsWith("sync-rooms.ts")) {
  if (existsSync(".env")) process.loadEnvFile(".env");
  // --demo-bookings: добавить демо-брони, только если броней ещё нет (существующие данные не трогаются).
  syncRooms()
    .then(async (r) => {
      console.log("Аудитории синхронизированы:", r);
      if (process.argv.includes("--demo-bookings")) console.log("Броней в БД:", await seedRoomBookings("alina.lebedeva"));
    })
    .finally(() => prisma.$disconnect());
}
