import { describe, expect, it } from "vitest";
import { isRequestType } from "@/lib/requests/catalog";
import { mailtoHref, officeHref, officeSubject, SUPPORT_OFFICES } from "./offices";

describe("справочник «Куда обратиться»", () => {
  it("службы с уникальными id, вымышленной почтой и существующими заявками", () => {
    expect(new Set(SUPPORT_OFFICES.map((o) => o.id)).size).toBe(SUPPORT_OFFICES.length);
    for (const o of SUPPORT_OFFICES) {
      expect(o.id, o.title).toMatch(/^[a-z]+$/);
      // .example зарезервирован (RFC 2606): письмо на демо-адрес никому не уйдёт.
      expect(o.email, o.title).toMatch(/^[a-z]+@university\.example$/);
      expect(o.topics.length, o.title).toBeGreaterThan(0);
      for (const t of o.requests) expect(isRequestType(t), `${o.title}: ${t}`).toBe(true);
    }
  });

  it("тема письма: подставлена группа, остальное заполняет студент", () => {
    const dean = SUPPORT_OFFICES.find((o) => o.id === "dean")!;
    expect(officeSubject(dean, "К3120")).toBe("<Тема вопроса>, группа К3120");
    for (const o of SUPPORT_OFFICES) expect(officeSubject(o, "К3120")).not.toContain("{group}");
    expect(mailtoHref(dean, "К3120")).toBe(`mailto:dekanat@university.example?subject=${encodeURIComponent("<Тема вопроса>, группа К3120")}`);
    expect(officeHref(dean)).toBe("/services/support#dean");
  });
});
