"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { StaffActionState } from "@/lib/staff/requests";
import { changeFacultyRequest } from "@/server/dal/staff";
import { requireStaff } from "@/server/session";

export async function changeRequestAction(_previous: StaffActionState, form: FormData): Promise<StaffActionState> {
  await requireStaff();
  const result = await changeFacultyRequest({
    id: form.get("id"), fromStatus: form.get("fromStatus"), toStatus: form.get("toStatus"), comment: form.get("comment"),
  });
  if (result.ok) {
    revalidatePath("/staff", "layout");
    revalidatePath("/requests", "layout");
    revalidatePath("/notifications");
    revalidatePath("/today");
    redirect(`/staff/requests/${encodeURIComponent(String(form.get("id")))}?updated=${encodeURIComponent(String(form.get("toStatus")))}`);
  }
  return result;
}
