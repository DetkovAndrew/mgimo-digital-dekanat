"use server";

import { revalidatePath } from "next/cache";
import { removeMyAvatar, uploadMyAvatar, type AvatarResult } from "@/server/dal/avatar";

export async function uploadAvatarAction(form: FormData): Promise<AvatarResult> {
  const r = await uploadMyAvatar(form.get("avatar"));
  if (r.ok) revalidatePath("/", "layout"); // фото и в шапке, и в меню
  return r;
}

export async function removeAvatarAction(): Promise<AvatarResult> {
  const r = await removeMyAvatar();
  revalidatePath("/", "layout");
  return r;
}
