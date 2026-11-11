"use server";

import { revalidatePath } from "next/cache";
import { bookSlot, cancelMyBooking, type SportActionResult } from "@/server/dal/sport";

export async function book(slotId: string, queue: boolean): Promise<SportActionResult> {
  const r = await bookSlot(String(slotId), { queue: queue === true });
  revalidatePath("/", "layout"); // тренировка появляется в расписании и на «Сегодня»
  return r;
}

export async function cancelBooking(bookingId: string): Promise<SportActionResult> {
  const r = await cancelMyBooking(String(bookingId));
  revalidatePath("/", "layout");
  return r;
}
