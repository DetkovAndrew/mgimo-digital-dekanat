import { describe, expect, it } from "vitest";
import { allowedTransitions, changeRequestSchema, requestStatuses } from "./requests";

describe("переходы заявок деканата", () => {
  it("разрешает только рабочие переходы, завершённые заявки не открываются снова", () => {
    const expected = {
      SUBMITTED: ["IN_PROGRESS", "REJECTED"], IN_PROGRESS: ["NEEDS_INFO", "READY", "REJECTED"],
      NEEDS_INFO: ["IN_PROGRESS", "REJECTED"], READY: ["DONE"], DONE: [], REJECTED: [], CANCELLED: [],
    };
    for (const fromStatus of requestStatuses) {
      expect(allowedTransitions(fromStatus)).toEqual(expected[fromStatus]);
      for (const toStatus of requestStatuses) {
        const result = changeRequestSchema.safeParse({ id: "request", fromStatus, toStatus, comment: "Комментарий" });
        expect(result.success).toBe((expected[fromStatus] as readonly string[]).includes(toStatus));
      }
    }
  });

  it("требует непустой комментарий при уточнении и отказе, ограничивает его 500 символами", () => {
    for (const toStatus of ["NEEDS_INFO", "REJECTED"]) {
      expect(changeRequestSchema.safeParse({ id: "r", fromStatus: "IN_PROGRESS", toStatus, comment: "   " }).success).toBe(false);
      expect(changeRequestSchema.safeParse({ id: "r", fromStatus: "IN_PROGRESS", toStatus, comment: "а".repeat(500) }).success).toBe(true);
      expect(changeRequestSchema.safeParse({ id: "r", fromStatus: "IN_PROGRESS", toStatus, comment: "а".repeat(501) }).success).toBe(false);
    }
    expect(changeRequestSchema.safeParse({ id: "r", fromStatus: "SUBMITTED", toStatus: "IN_PROGRESS" }).success).toBe(true);
  });
});
