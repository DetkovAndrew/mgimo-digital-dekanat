import { describe, expect, it } from "vitest";
import { MAX_ANSWER_CHARS, parseInline, sanitizeAnswer } from "./answer";

const allowed = new Set(["/grades", "/courses/abc", "/requests/new?type=study_certificate"]);

describe("sanitizeAnswer: только ссылки из снимка", () => {
  it("оставляет разрешённую ссылку", () => {
    expect(sanitizeAnswer("См. [баллы](/courses/abc).", allowed)).toBe("См. [баллы](/courses/abc).");
  });

  it("чужие, внешние и опасные ссылки превращает в текст", () => {
    for (const href of ["/courses/zzz", "https://evil.example", "//evil.example", "javascript:alert(1)", "/courses/abc/../../x"]) {
      const out = sanitizeAnswer(`[жми](${href})`, allowed);
      expect(out.startsWith("жми")).toBe(true);
      expect(parseInline(out).some((x) => x.kind === "link")).toBe(false);
    }
  });

  it("вложенные скобки не склеивают запрещённую ссылку (ревью Codex 19)", () => {
    for (const md of ["[outer [go](/forbidden)](/requests/not-mine)", "[[x](/grades)](/courses/zzz)", "[a [b [c](/x)](/y)](/z)"]) {
      const out = sanitizeAnswer(md, allowed);
      expect(parseInline(out).filter((x) => x.kind === "link").every((x) => x.kind === "link" && allowed.has(x.href))).toBe(true);
    }
  });

  it("длинная метка или путь не проходят мимо проверки (ревью Codex 17)", () => {
    for (const md of [`[${"м".repeat(200)}](/requests/not-mine)`, `[x](/courses/${"a".repeat(300)})`]) {
      expect(parseInline(sanitizeAnswer(md, allowed)).some((x) => x.kind === "link")).toBe(false);
    }
  });

  it("голый путь из снимка становится ссылкой, не ломая готовые ссылки", () => {
    expect(sanitizeAnswer("Подать здесь: /requests/new?type=study_certificate.", allowed)).toBe(
      "Подать здесь: [открыть](/requests/new?type=study_certificate).",
    );
    expect(sanitizeAnswer("[Учёба](/grades) и /grades", allowed)).toBe("[Учёба](/grades) и [открыть](/grades)");
    expect(sanitizeAnswer("путь /courses/zzz", allowed)).toBe("путь /courses/zzz");
  });

  it("голый путь со службой и якорем тоже становится ссылкой, чужой якорь — нет", () => {
    const withOffice = new Set([...allowed, "/services/support#scholarship"]);
    expect(sanitizeAnswer("Подробности — в службе /services/support#scholarship.", withOffice)).toBe(
      "Подробности — в службе [открыть](/services/support#scholarship).",
    );
    expect(sanitizeAnswer("см. /services/support#evil", withOffice)).toBe("см. /services/support#evil");
  });

  it("путь в квадратных скобках, как в снимке: разрешённый — ссылка, чужой — убирается", () => {
    expect(sanitizeAnswer("Пара [/courses/abc]", allowed)).toBe("Пара [открыть](/courses/abc)");
    expect(sanitizeAnswer("Пара [/lessons/other]", allowed)).toBe("Пара ");
  });

  it("обрезает слишком длинный ответ", () => {
    expect(sanitizeAnswer("а".repeat(MAX_ANSWER_CHARS + 50), allowed)).toHaveLength(MAX_ANSWER_CHARS);
  });
});

describe("parseInline: клиент рисует только текст, жирный и локальные ссылки", () => {
  it("разбирает жирный и ссылку", () => {
    expect(parseInline("Итого **35** — [баллы](/courses/abc)")).toEqual([
      { kind: "text", text: "Итого " },
      { kind: "bold", text: "35" },
      { kind: "text", text: " — " },
      { kind: "link", text: "баллы", href: "/courses/abc" },
    ]);
  });

  it("внешняя ссылка и HTML остаются текстом", () => {
    expect(parseInline("[x](https://evil.example)")).toEqual([{ kind: "text", text: "x" }]);
    expect(parseInline("<img src=x onerror=alert(1)>")).toEqual([{ kind: "text", text: "<img src=x onerror=alert(1)>" }]);
  });
});
