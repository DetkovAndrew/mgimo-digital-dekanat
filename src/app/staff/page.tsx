import { Disclaimer } from "@/components/disclaimer";
import { SignOut } from "@/components/nav";
import { requireStaff } from "@/server/session";

export default async function StaffPage() {
  await requireStaff();
  return (
    <div className="min-h-dvh">
      <Disclaimer />
      <main className="mx-auto max-w-lg px-4 py-10 text-center">
        <h1 className="mb-2 text-2xl font-semibold">Кабинет сотрудника деканата</h1>
        <p className="mb-6 text-slate-500">В разработке: здесь будут заявки студентов факультета.</p>
        <SignOut className="rounded-xl bg-white px-4 py-2 text-sm ring-1 ring-black/5" />
      </main>
    </div>
  );
}
