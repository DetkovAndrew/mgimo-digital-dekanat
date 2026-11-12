import { readAvatar } from "@/server/dal/avatar";
import { studentForApi } from "@/server/session";

// Своё фото профиля. Чужого не отдаём: id в адресе нет, владелец только из сессии (docs/plans/avatars.md).
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET() {
  const s = await studentForApi();
  if (!s.ok) return new Response(null, { status: s.status, headers: PRIVATE });
  const a = await readAvatar(s.student.studentId);
  if (!a) return new Response(null, { status: 404, headers: PRIVATE });
  return new Response(a.data, {
    headers: {
      ...PRIVATE,
      "Content-Type": a.mime,
      "Content-Disposition": "inline",
      // Даже если откроют напрямую: никаких скриптов и подгрузок.
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
