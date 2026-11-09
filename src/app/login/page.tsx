import { redirect } from "next/navigation";
import { Disclaimer } from "@/components/disclaimer";
import { getCurrentRole } from "@/server/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getCurrentRole()) redirect("/");
  return (
    <div className="flex min-h-dvh flex-col">
      <Disclaimer />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-brand text-xl font-bold text-white">U</div>
          <h1 className="text-2xl font-semibold">Деканат University</h1>
          <p className="mt-1 text-sm text-slate-500">Личный кабинет студента</p>
        </div>
        <LoginForm />
      </main>
    </div>
  );
}
