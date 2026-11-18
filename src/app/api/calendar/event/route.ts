import { buildCalendar } from "@/lib/calendar/ics";
import { EVENT_KINDS, type EventKind, getMyEvent } from "@/server/dal/calendar";
import { studentForApi } from "@/server/session";

// Одно событие в календарь: пара, экзамен или срок, тренировка, бронь. Только своё (группа или владелец), иначе 404.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRIVATE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const ID = /^[a-z0-9]{1,40}$/;

export async function GET(request: Request) {
  const who = await studentForApi();
  if (!who.ok) return new Response(who.status === 401 ? "Войдите в кабинет" : "Только для студентов", { status: who.status, headers: PRIVATE });
  const q = new URL(request.url).searchParams;
  const kind = q.get("kind");
  const id = q.get("id") ?? "";
  if (!EVENT_KINDS.includes(kind as EventKind) || !ID.test(id)) return new Response("Не найдено", { status: 404, headers: PRIVATE });
  const event = await getMyEvent(kind as EventKind, id);
  if (!event) return new Response("Не найдено", { status: 404, headers: PRIVATE });
  return new Response(buildCalendar([event], { name: "University" }), {
    headers: { ...PRIVATE, "Content-Type": "text/calendar; charset=utf-8; method=PUBLISH", "Content-Disposition": `inline; filename="university-${kind}.ics"` },
  });
}
