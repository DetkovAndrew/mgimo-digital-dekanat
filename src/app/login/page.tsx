import { redirect } from "next/navigation";
import { Disclaimer } from "@/components/disclaimer";
import { Logo } from "@/components/nav";
import { getCurrentRole } from "@/server/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  if (await getCurrentRole()) redirect("/");
  return (
    <div className="flex min-h-dvh flex-col">
      <Disclaimer />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
        <div className="mb-8 text-center">
          <span className="mb-4 inline-block">
            <Logo size={56} />
          </span>
          <h1 className="text-h1 leading-tight font-bold tracking-tight">University</h1>
          <p className="mt-1 text-body text-ink-2">Цифровой деканат: кабинет студента</p>
        </div>
        <LoginForm />
      </main>
    </div>
  );
}
