import { describe, expect, it } from "vitest";
import { formatDocumentNumber, issuesCertificate, shortName, VERIFY_TOKEN, verifyPath } from "./certificate";

describe("электронная справка: общий код", () => {
  it("номер справки — кириллическая «С» и шесть цифр", () => {
    expect(formatDocumentNumber(12)).toBe("С-000012");
    expect(formatDocumentNumber(1234567)).toBe("С-1234567");
  });

  it("на открытой странице — фамилия и инициалы", () => {
    expect(shortName("Деморина Алина Витальевна")).toBe("Деморина А. В.");
    expect(shortName("  Слотвина   Ёлка  ")).toBe("Слотвина Ё.");
    expect(shortName("Иванов-Петров Анна-Мария")).toBe("Иванов-Петров А.");
    expect(shortName("Мононим")).toBe("Мононим");
  });

  it("PDF выпускается только для электронной справки об обучении", () => {
    expect(issuesCertificate("study_certificate", { format: "electronic" })).toBe(true);
    expect(issuesCertificate("study_certificate", { format: "paper" })).toBe(false);
    expect(issuesCertificate("scholarship_certificate", { format: "electronic" })).toBe(false);
    expect(issuesCertificate("study_certificate", null)).toBe(false);
    expect(issuesCertificate("study_certificate", "electronic")).toBe(false);
  });

  it("токен проверки — ровно 22 символа base64url", () => {
    expect(VERIFY_TOKEN.test("AbCdEfGhIjKlMnOpQrSt_-")).toBe(true);
    for (const bad of ["AbCdEfGhIjKlMnOpQrSt_", "AbCdEfGhIjKlMnOpQrSt_-x", "AbCdEfGhIjKlMnOpQrSt/+", "../../etc/passwd012345", ""]) {
      expect(VERIFY_TOKEN.test(bad)).toBe(false);
    }
    expect(verifyPath("AbCdEfGhIjKlMnOpQrSt_-")).toBe("/verify/AbCdEfGhIjKlMnOpQrSt_-");
  });
});
