import { buildCalendar } from "@/lib/calendar/ics";
import { getMyCalendarFile } from "@/server/dal/calendar";
import { studentForApi } from "@/server/session";

// Файл .ics по сессии: текущая неделя или семестр с сессией. Разовый снимок; диапазон задаёт сервер.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRIVATE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request) {
  const who = await studentForApi();
  if (!who.ok) return new Response(who.status === 401 ? "Войдите в кабинет" : "Только для студентов", { status: who.status, headers: PRIVATE });
  const scope = new URL(request.url).searchParams.get("range") === "term" ? "term" : "week";
  const body = buildCalendar(await getMyCalendarFile(scope), { name: scope === "week" ? "University · неделя" : "University · семестр" });
  return new Response(body, {
    headers: { ...PRIVATE, "Content-Type": "text/calendar; charset=utf-8; method=PUBLISH", "Content-Disposition": `inline; filename="university-${scope}.ics"` },
  });
}
