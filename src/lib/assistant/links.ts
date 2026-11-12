import { planFor } from "@/lib/campus/plans";
import { roomDayKeys } from "@/lib/campus/rules";
import { prefillFor } from "@/lib/requests/prefill";

// Какие ссылки помощник может дать студенту (ревью Codex 18): точные пути из снимка кабинета
// и два проверенных шаблона. Ссылка разбирается и собирается заново в каноническом виде;
// неизвестные или повторяющиеся параметры, чужие корпуса и даты вне окна брони — отказ.

const ROOM_KEYS = new Set(["room", "d", "floor"]);

export function canonicalLink(href: string, known: ReadonlySet<string>, now = new Date()): string | null {
  if (!href.startsWith("/") || href.startsWith("//")) return null;
  // Шаблоны нормализуются всегда (одна и та же ссылка — один вид), точный список — для остальных путей.
  if (!/^\/(rooms\/|requests\/new(\?|$))/.test(href)) return known.has(href) ? href : null;
  let url: URL;
  try {
    url = new URL(href, "http://local.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "http://local.invalid" || (url.hash && url.hash !== "#room")) return null;
  const params = [...url.searchParams];
  if (new Set(params.map(([k]) => k)).size !== params.length) return null;

  const rooms = url.pathname.match(/^\/rooms\/([a-z-]{1,20})$/);
  if (rooms) {
    const plan = planFor(rooms[1]);
    if (!plan || params.some(([k]) => !ROOM_KEYS.has(k))) return null;
    const room = url.searchParams.get("room");
    const d = url.searchParams.get("d");
    const floor = url.searchParams.get("floor");
    if (room !== null && !plan.rooms.some((r) => r.number === room)) return null;
    if (d !== null && !roomDayKeys(now).includes(d)) return null;
    if (floor !== null && !plan.floors.includes(Number(floor))) return null;
    const q = new URLSearchParams();
    if (floor && !room) q.set("floor", floor);
    if (room) q.set("room", room);
    if (d) q.set("d", d);
    const qs = q.toString();
    return `/rooms/${plan.buildingId}${qs ? `?${qs}` : ""}${room ? "#room" : ""}`;
  }

  if (url.pathname === "/requests/new") {
    const type = url.searchParams.get("type");
    const fields = type ? prefillFor(type, params) : null;
    if (!type || !fields) return null;
    return `/requests/new?${new URLSearchParams({ type, ...fields })}`;
  }
  return null;
}
