import { buildCalendar } from "@/lib/calendar/ics";
import { feedEvents, feedOwnerByToken } from "@/server/dal/calendar";
import { clientKey, slidingLimiter } from "@/server/documents/verify-limit";

// Подписка на календарь (docs/plans/calendar.md): календарь телефона ходит без cookies, доступ — по секретному токену.
// Токен не журналируем (фильтр Caddy — deploy/Caddyfile); на любом ответе — no-store, noindex, no-referrer.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};
// Календарь перечитывает подписку раз в несколько минут или часов; 20 запросов в минуту с адреса хватает с запасом.
const take = slidingLimiter(20);
const text = (body: string, status: number) => new Response(body, { status, headers: { ...HEADERS, "Content-Type": "text/plain; charset=utf-8" } });

export async function GET(request: Request, { params }: RouteContext<"/api/calendar/feed/[token]">) {
  if (!take(clientKey(request.headers.get("x-forwarded-for")))) return text("Слишком много запросов. Попробуйте через минуту.", 429);
  try {
    const owner = await feedOwnerByToken((await params).token);
    if (!owner) return text("Не найдено", 404);
    const body = buildCalendar(await feedEvents(owner), { name: "University · расписание", feed: true });
    return new Response(body, { headers: { ...HEADERS, "Content-Type": "text/calendar; charset=utf-8; method=PUBLISH", "Content-Disposition": 'inline; filename="university.ics"' } });
  } catch {
    // Ни токен, ни внутреннюю ошибку не выводим и не журналируем.
    return text("Календарь временно недоступен", 503);
  }
}
