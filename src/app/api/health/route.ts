import { databaseReady } from "@/server/health";

// Проверка живости для Docker и мониторинга: сервер отвечает и база доступна. Никаких данных наружу.
export const dynamic = "force-dynamic";

export async function GET() {
  const ok = await databaseReady();
  return Response.json({ ok }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
