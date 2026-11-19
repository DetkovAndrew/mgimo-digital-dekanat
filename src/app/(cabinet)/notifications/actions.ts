"use server";

import { revalidatePath } from "next/cache";
import { hideMyNotifications, restoreMyNotifications } from "@/server/dal/notifications";

// Владелец — из сессии внутри DAL; owner (чей список открыт) сверяется с ней, id из браузера — только селекторы. Счётчик колокольчика в макете — revalidate "layout".
export async function hideNotifications(owner: string, ids: string[]) {
  const r = await hideMyNotifications(ids, owner);
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

export async function restoreNotifications(owner: string, ids: string[], at: string) {
  const r = await restoreMyNotifications({ ids, at }, owner);
  if (r.count) revalidatePath("/", "layout");
  return r;
}
