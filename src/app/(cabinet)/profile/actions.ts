"use server";

import { revalidatePath } from "next/cache";
import { removeMyAvatar, uploadMyAvatar, type AvatarResult } from "@/server/dal/avatar";
import { setMySkin, type SkinResult } from "@/server/dal/skins";

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

export async function setSkinAction(skin: string): Promise<SkinResult> {
  const r = await setMySkin(skin);
  if (r.ok) revalidatePath("/", "layout"); // образ и на кнопке помощника, и на маршруте
  return r;
}
