"use server";

import { revalidatePath } from "next/cache";
import { rotateMyFeed } from "@/server/dal/calendar";

/** Новая ссылка подписки: владелец — из сессии (rotateMyFeed), старая ссылка перестаёт работать. */
export async function rotateFeedAction(): Promise<{ ok: boolean; message: string }> {
  const r = await rotateMyFeed();
  revalidatePath("/schedule/export");
  return r;
}
