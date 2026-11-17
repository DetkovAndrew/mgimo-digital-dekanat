import { describe, expect, it } from "vitest";
import { completeOfficeContacts, dropCatalogFields, MAX_ANSWER_CHARS, parseInline, sanitizeAnswer } from "./answer";

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

describe("completeOfficeContacts: факты службы — из справочника", () => {
  const stipend = {
    href: "/services/support#scholarship",
    title: "Стипендиальный отдел",
    where: "Кронверкский, 49, 1-й этаж",
    hours: "вт и чт с 11 до 16",
    email: "stipend@university.example",
    subject: "Стипендия за <месяц>: <что случилось>, группа P3212",
  };
  const care = { ...stipend, href: "/services/support#care", title: "Психологическая служба", where: "Кронверкский, 49, 4-й этаж", email: "care@university.example" };

  it("почта есть, темы нет — дописывает только тему; тема одной службы не закрывает тему другой (ревью Codex 69)", () => {
    const text = "[Стипендиальный отдел](/services/support#scholarship): Кронверкский, 49, 1-й этаж, вт и чт с 11 до 16, stipend@university.example.";
    expect(completeOfficeContacts(text, [stipend])).toBe(`${text}\nТема письма: «${stipend.subject}».`);
    const intl = { ...stipend, href: "/services/support#international", title: "Международный офис", where: "Ломоносова, 9, 3-й этаж", email: "international@university.example", subject: "Обмен: <программа или вуз>, группа P3212" };
    const two = `[Офис](/services/support#international): Ломоносова, 9, 3-й этаж, вт и чт с 11 до 16, international@university.example, тема письма: «Обмен: Лейден, группа P3212».\n${text}`;
    expect(completeOfficeContacts(two, [stipend, intl])).toBe(`${two}\nСтипендиальный отдел: тема письма: «${stipend.subject}».`);
  });

  it("тема с одной лишь группой: упоминание группы или чужая тема её не закрывают (ревью Codex 70)", () => {
    const dean = { ...stipend, href: "/services/support#dean", title: "Деканат", where: "Кронверкский, 49, ауд. 1117", hours: "по будням с 10 до 17", email: "dekanat@university.example", subject: "<Тема вопроса>, группа P3212" };
    const intl = { ...dean, href: "/services/support#international", title: "Международный офис", where: "Ломоносова, 9, 3-й этаж", email: "international@university.example", subject: "Обмен: <программа или вуз>, группа P3212" };
    const one = "[Деканат](/services/support#dean): Кронверкский, 49, ауд. 1117, по будням с 10 до 17, dekanat@university.example. Вы в группе P3212.";
    expect(completeOfficeContacts(one, [dean])).toBe(`${one}\nТема письма: «${dean.subject}».`);
    const both = `${one}\n[Офис](/services/support#international): Ломоносова, 9, 3-й этаж, по будням с 10 до 17, international@university.example, тема письма: «Обмен: Лейден, группа P3212».`;
    expect(completeOfficeContacts(both, [dean, intl])).toBe(`${both}\nДеканат: тема письма: «${dean.subject}».`);
    const library = { ...dean, href: "/services/support#library", title: "Библиотека", where: "Ломоносова, 9, 2-й этаж", email: "library@university.example", subject: "<Вопрос>, группа P3212" };
    const libOnly = `${one}\n[Библиотека](/services/support#library): Ломоносова, 9, 2-й этаж, по будням с 10 до 17, library@university.example, тема письма: «Курсовая, группа P3212».`;
    expect(completeOfficeContacts(libOnly, [dean, library])).toBe(`${libOnly}\nДеканат: тема письма: «${dean.subject}».`);
    const done = "[Деканат](/services/support#dean): Кронверкский, 49, ауд. 1117, по будням с 10 до 17, dekanat@university.example, в теме укажите «Пересдача, группа P3212».";
    expect(completeOfficeContacts(done, [dean])).toBe(done);
  });

  it("дописывает потерянную почту, тему не повторяет", () => {
    const text = "Напишите в службу «Стипендиальный отдел»: [страница службы](/services/support#scholarship).\nГде: Кронверкский, 49, 1-й этаж; часы: вт и чт с 11 до 16.\nТема письма: «Стипендия за октябрь: не пришла, группа P3212».";
    expect(completeOfficeContacts(text, [stipend, care])).toBe(`${text}\nПочта stipend@university.example.`);
  });

  it("без места и почты — дописывает оба, с темой; полный ответ и ответ без ссылки на службу не трогает", () => {
    expect(completeOfficeContacts("Вам в [стипендиальный отдел](/services/support#scholarship).", [stipend])).toBe(
      "Вам в [стипендиальный отдел](/services/support#scholarship).\nКронверкский, 49, 1-й этаж, вт и чт с 11 до 16.\nПочта stipend@university.example, тема письма: «Стипендия за <месяц>: <что случилось>, группа P3212».",
    );
    const full = "[Служба](/services/support#scholarship). Кронверкский, 49, 1-й этаж, вт и чт с 11 до 16, stipend@university.example, тема: «стипендия за ноябрь: не пришла, группа P3212»";
    expect(completeOfficeContacts(full, [stipend])).toBe(full);
    expect(completeOfficeContacts("Напишите в стипендиальный отдел.", [stipend])).toBe("Напишите в стипендиальный отдел.");
  });

  it("две службы в ответе — с названием; длиннее предела не делает", () => {
    const two = "[Стипендия](/services/support#scholarship) и [психолог](/services/support#care).";
    expect(completeOfficeContacts(two, [stipend, care]).split("\n").slice(1)[0]).toMatch(/^Стипендиальный отдел: Кронверкский/);
    const long = `${"а".repeat(MAX_ANSWER_CHARS - 60)} [служба](/services/support#scholarship)`;
    expect(completeOfficeContacts(long, [stipend])).toBe(long);
  });
});

describe("dropCatalogFields: пересказ «полей ссылки» каталога — только по именам его полей", () => {
  const keys = new Set(["office", "format", "document", "reason", "language"]);

  it("строку с полями убирает, поля внутри адреса ссылки оставляет", () => {
    const href = "/requests/new?type=military_certificate&format=paper";
    const leak = [
      `Вам подойдёт [справка для военкомата](${href}).`,
      "",
      "В ссылку: &office=текст (военный комиссариат), &format=electronic|paper (формат).",
      "",
      "Срок ≈ 3 раб. дн.",
    ].join("\n");
    expect(dropCatalogFields(leak, keys)).toBe(`Вам подойдёт [справка для военкомата](${href}).\n\nСрок ≈ 3 раб. дн.`);
    expect(dropCatalogFields("Срок ≈ 5 раб. дн.; поля: document=student_card|record_book, reason=текст\nПодробнее — в заявках.", keys)).toBe("Подробнее — в заявках.");
    expect(dropCatalogFields("Язык: &language=en.\nГотово.", keys)).toBe("Готово.");
    expect(dropCatalogFields("Поля ссылки этой заявки — ниже.\nГотово.", keys)).toBe("Готово.");
  });

  it("обычный текст с | и = не трогает (ревью Codex 69)", () => {
    for (const t of ["Цель: «Подготовка доклада про cat|grep».", "В уведомлении: «a=b, x|y».", "«В шаблоне письма замените en|ru на нужный язык»", "Формат: paper|electronic."]) {
      expect(dropCatalogFields(t, keys)).toBe(t);
    }
  });
});
