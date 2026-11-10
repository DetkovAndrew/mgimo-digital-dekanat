"use server";

import { revalidatePath } from "next/cache";
import { cancelMyBooking, runDemoDraw, saveMyPreferences, type SportActionResult } from "@/server/dal/sport";

export async function savePreferences(weekStart: string, slotIds: string[]): Promise<SportActionResult> {
  if (!Array.isArray(slotIds) || slotIds.some((id) => typeof id !== "string")) return { ok: false, error: "Неверные данные" };
  const r = await saveMyPreferences(String(weekStart), slotIds);
  revalidatePath("/sport");
  return r;
}

export async function demoDraw(): Promise<SportActionResult> {
  const r = await runDemoDraw();
  revalidatePath("/", "layout");
  return r;
}

export async function cancelBooking(bookingId: string): Promise<SportActionResult> {
  const r = await cancelMyBooking(String(bookingId));
  revalidatePath("/", "layout");
  return r;
}
