import { buildVCard } from "@/lib/calendar/vcard";
import { SUPPORT_OFFICES } from "@/lib/support/offices";
import { studentForApi } from "@/server/session";

// «В контакты» у службы из «Куда обратиться»: справочник, не личные данные; отдаём вошедшему студенту.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRIVATE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(_request: Request, { params }: RouteContext<"/api/contacts/[office]">) {
  const who = await studentForApi();
  if (!who.ok) return new Response(who.status === 401 ? "Войдите в кабинет" : "Только для студентов", { status: who.status, headers: PRIVATE });
  const { office } = await params;
  const o = SUPPORT_OFFICES.find((x) => x.id === office);
  if (!o) return new Response("Не найдено", { status: 404, headers: PRIVATE });
  const card = buildVCard({ org: "University", name: o.title, email: o.email, address: o.where, note: `Часы: ${o.hours}. С чем обращаться: ${o.topics.join("; ")}. Данные вымышлены (концепт для конкурса).` });
  return new Response(card, {
    headers: { ...PRIVATE, "Content-Type": "text/vcard; charset=utf-8", "Content-Disposition": `inline; filename="university-${o.id}.vcf"` },
  });
}
