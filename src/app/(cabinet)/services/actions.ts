"use server";

import { revalidatePath } from "next/cache";
import { cancelMyPrintJob, createMyPrintJob, releaseMyPrintJob, type PrintResult } from "@/server/dal/print";
import { rotateMyWifiPassword } from "@/server/dal/wifi";

// Действия «Сервисов»: всё решает DAL (сессия, zod, блокировки); здесь только обновление страниц.

export async function createPrintJobAction(input: { fileName: string; pages: number; copies: number; color: boolean; duplex: boolean }): Promise<PrintResult> {
  const r = await createMyPrintJob(input);
  revalidatePath("/services", "layout");
  return r;
}

export async function cancelPrintJobAction(id: string): Promise<PrintResult> {
  const r = await cancelMyPrintJob(id);
  revalidatePath("/services", "layout");
  return r;
}

export async function releasePrintJobAction(id: string, printerId: string): Promise<PrintResult> {
  const r = await releaseMyPrintJob(id, printerId);
  revalidatePath("/services", "layout");
  return r;
}

export async function rotateWifiAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await rotateMyWifiPassword();
  revalidatePath("/services/wifi");
  return r;
}
