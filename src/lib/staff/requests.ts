import { z } from "zod";

export const requestStatuses = ["SUBMITTED", "IN_PROGRESS", "NEEDS_INFO", "READY", "DONE", "REJECTED", "CANCELLED"] as const;
export type StaffRequestStatus = (typeof requestStatuses)[number];

const transitions: Record<StaffRequestStatus, readonly StaffRequestStatus[]> = {
  SUBMITTED: ["IN_PROGRESS", "REJECTED"],
  IN_PROGRESS: ["NEEDS_INFO", "READY", "REJECTED"],
  NEEDS_INFO: ["IN_PROGRESS", "REJECTED"],
  READY: ["DONE"],
  DONE: [],
  REJECTED: [],
  CANCELLED: [],
};

export const allowedTransitions = (status: StaffRequestStatus) => transitions[status];
export const canTransition = (from: StaffRequestStatus, to: StaffRequestStatus) => transitions[from].includes(to);
export const needsComment = (status: StaffRequestStatus) => status === "NEEDS_INFO" || status === "REJECTED";

export const staffFilters = [
  { value: "SUBMITTED", label: "Новые" },
  { value: "IN_PROGRESS", label: "В работе" },
  { value: "NEEDS_INFO", label: "Ждут студента" },
  { value: "READY", label: "Готовы" },
  { value: "ALL", label: "Все" },
] as const;
export type StaffFilter = (typeof staffFilters)[number]["value"];
export const isStaffFilter = (value: unknown): value is StaffFilter => staffFilters.some((f) => f.value === value);

// Для «Все»: сначала новые и незавершённые, внутри каждой очереди — самые старые.
export const requestPriority = (status: StaffRequestStatus) => {
  if (status === "SUBMITTED") return 0;
  if (status === "IN_PROGRESS") return 1;
  if (status === "NEEDS_INFO") return 2;
  if (status === "READY") return 3;
  return 4;
};

export const changeRequestSchema = z.object({
  id: z.string().min(1).max(128),
  fromStatus: z.enum(requestStatuses),
  toStatus: z.enum(requestStatuses),
  comment: z.string().trim().max(500, "Комментарий — не больше 500 символов").default(""),
}).superRefine((value, ctx) => {
  if (!canTransition(value.fromStatus, value.toStatus)) {
    ctx.addIssue({ code: "custom", path: ["toStatus"], message: "Такой переход статуса недоступен" });
  }
  if (needsComment(value.toStatus) && !value.comment) {
    ctx.addIssue({ code: "custom", path: ["comment"], message: "Напишите комментарий для студента" });
  }
});

export type StaffActionState = { ok: boolean; message?: string };
