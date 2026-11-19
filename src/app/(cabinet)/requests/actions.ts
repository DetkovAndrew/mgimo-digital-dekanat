"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { answerMyRequest, cancelMyRequest, createMyRequest } from "@/server/dal/requests";

export type FormState = { fieldErrors?: Record<string, string[]>; formError?: string };

export async function submitRequest(type: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const input = Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)]));
  const result = await createMyRequest(type, input);
  if (!result.ok) return { fieldErrors: result.fieldErrors, formError: result.formError ?? "Проверьте поля формы" };
  revalidatePath("/", "layout");
  redirect(`/requests/${result.id}?created=1`);
}

export async function cancelRequest(id: string) {
  await cancelMyRequest(id);
  revalidatePath("/requests", "layout"); // и «Мои заявки» со счётчиком на вкладке (ревью Codex 90)
}

export async function answerRequest(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const result = await answerMyRequest(id, String(formData.get("comment") ?? ""));
  if (!result.ok) return { formError: result.error };
  revalidatePath("/requests", "layout");
  return {};
}
