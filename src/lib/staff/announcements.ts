import { z } from "zod";

// Объявление деканата студентам своего факультета: всем, одному курсу или одной группе. Проверка ввода;
// кому доставить, решает сервер по факультету сотрудника (src/server/dal/staff-announcements.ts).

export const ANNOUNCE_LIMIT = { perHour: 10 } as const;

export const announcementSchema = z
  .object({
    audience: z.enum(["faculty", "course", "group"]),
    course: z.string().trim().max(2),
    group: z.string().trim().max(16),
    title: z.string().trim().min(3, "Заголовок — от 3 символов").max(80, "Заголовок — до 80 символов"),
    body: z.string().trim().min(10, "Текст — от 10 символов").max(1000, "Текст — до 1000 символов"),
    important: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.audience === "course" && !/^[1-6]$/.test(v.course)) ctx.addIssue({ code: "custom", path: ["course"], message: "Выберите курс" });
    if (v.audience === "group" && !v.group) ctx.addIssue({ code: "custom", path: ["group"], message: "Выберите группу" });
  });

export type AnnouncementInput = z.infer<typeof announcementSchema>;
export type AnnounceActionState = { ok: boolean; message?: string };
