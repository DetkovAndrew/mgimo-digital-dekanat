"use server";

import { revalidatePath } from "next/cache";
import { bookRoom, bookRoomAs, cancelMyRoomBooking, type RoomActionResult } from "@/server/dal/rooms";

export async function bookRoomAction(input: { roomId: string; day: string; start: string; minutes: number; purpose: string }): Promise<RoomActionResult> {
  const r = await bookRoom(input);
  revalidatePath("/rooms", "layout");
  return r;
}

export async function cancelRoomBookingAction(id: string): Promise<RoomActionResult> {
  const r = await cancelMyRoomBooking(String(id));
  revalidatePath("/rooms", "layout");
  return r;
}

/** Бронь из карточки Инвиктии: сервер сверяет владельца разговора с сессией перед записью. */
export async function bookFromAssistantAction(owner: string, input: { roomId: string; day: string; start: string; minutes: number; purpose: string }): Promise<RoomActionResult> {
  const r = await bookRoomAs(String(owner), input);
  revalidatePath("/rooms", "layout");
  return r;
}
