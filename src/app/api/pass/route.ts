import { issueStudentPass } from "@/server/dal/pass";
import { studentForApi } from "@/server/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRIVATE = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
};

export async function GET(request: Request) {
  try {
    const who = await studentForApi();
    if (!who.ok) {
      return Response.json({ error: who.status === 401 ? "Войдите в кабинет." : "Пропуск доступен только студентам." }, { status: who.status, headers: PRIVATE });
    }
    // Защита от смены аккаунта в соседней вкладке: не отдаём новый код под старым профилем страницы.
    const owner = request.headers.get("X-Pass-Owner");
    if (owner && owner !== who.student.userId) {
      return Response.json({ error: "Аккаунт изменился. Откройте кабинет заново." }, { status: 409, headers: PRIVATE });
    }
    const now = Date.now();
    return Response.json(issueStudentPass(who.student, now), { headers: { ...PRIVATE, "X-Pass-Time": String(now) } });
  } catch {
    // Не выдаём в ответ и не журналируем ни секрет, ни внутреннюю ошибку.
    return Response.json({ error: "Демо-пропуск временно недоступен." }, { status: 503, headers: PRIVATE });
  }
}
