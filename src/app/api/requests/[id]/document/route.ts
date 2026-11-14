import { readMyCertificatePdf } from "@/server/dal/documents";
import { studentForApi } from "@/server/session";

// PDF своей справки (docs/plans/certificates.md). Владелец — из сессии, заявка из адреса — только селектор.
export const dynamic = "force-dynamic";

const PRIVATE = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(_req: Request, ctx: RouteContext<"/api/requests/[id]/document">) {
  const s = await studentForApi();
  if (!s.ok) return new Response(null, { status: s.status, headers: PRIVATE });
  const { id } = await ctx.params;
  const pdf = await readMyCertificatePdf(s.student.studentId, id);
  if (!pdf) return new Response(null, { status: 404, headers: PRIVATE });
  const latin = pdf.number.replace("С", "S"); // кириллическая «С» в номере
  return new Response(Buffer.from(pdf.bytes), {
    headers: {
      ...PRIVATE,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="spravka-${latin}.pdf"; filename*=UTF-8''${encodeURIComponent(`Справка-${pdf.number}.pdf`)}`,
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cross-Origin-Resource-Policy": "same-origin",
    },
  });
}
