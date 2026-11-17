"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { StaffActionState } from "@/lib/staff/requests";
import type { AnnounceActionState } from "@/lib/staff/announcements";
import type { ScheduleActionState } from "@/lib/staff/schedule";
import { changeFacultyRequest } from "@/server/dal/staff";
import { sendFacultyAnnouncement, withdrawFacultyAnnouncement } from "@/server/dal/staff-announcements";
import { rescheduleFacultyLesson } from "@/server/dal/staff-schedule";
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

const text = (form: FormData, key: string) => String(form.get(key) ?? "");

export async function rescheduleLessonAction(_previous: ScheduleActionState, form: FormData): Promise<ScheduleActionState> {
  await requireStaff();
  const result = await rescheduleFacultyLesson({
    action: text(form, "action"), id: text(form, "id"), expected: text(form, "expected"), reason: text(form, "reason"),
    date: text(form, "date"), start: text(form, "start"), end: text(form, "end"), building: text(form, "building"), room: text(form, "room"),
  });
  if (result.ok) {
    // Студенты группы видят изменение сразу: расписание, «Сегодня», карточка пары и уведомления.
    revalidatePath("/staff", "layout");
    revalidatePath("/schedule");
    revalidatePath("/today");
    revalidatePath("/notifications");
    revalidatePath("/lessons/[id]", "page");
    redirect(`/staff/schedule/${encodeURIComponent(text(form, "id"))}?updated=1`);
  }
  return result;
}

export async function sendAnnouncementAction(_previous: AnnounceActionState, form: FormData): Promise<AnnounceActionState> {
  await requireStaff();
  const result = await sendFacultyAnnouncement({
    audience: text(form, "audience"), course: text(form, "course"), group: text(form, "group"),
    title: text(form, "title"), body: text(form, "body"), important: form.get("important") === "on",
  });
  if (result.ok) {
    revalidatePath("/staff/announcements");
    revalidatePath("/notifications");
    revalidatePath("/today");
  }
  return result;
}


export async function withdrawAnnouncementAction(_previous: AnnounceActionState, form: FormData): Promise<AnnounceActionState> {
  await requireStaff();
  const result = await withdrawFacultyAnnouncement(form.get("id"));
  revalidatePath("/staff/announcements");
  revalidatePath("/notifications");
  revalidatePath("/today");
  return result;
}
