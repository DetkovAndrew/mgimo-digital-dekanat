import { describe, expect, it } from "vitest";
import { answerTransfer, words, type TransferFact } from "./transfer-answer";

const fact = (day: string, from: string, to: string, at: string, text: string): TransferFact => ({
  day,
  fromWords: words(from),
  toWords: words(to),
  toStartsAt: new Date(`${day}T${at}:00+03:00`),
  text,
});
const facts = [
  fact("2026-11-17", "English C1 / Английский язык C1 Иностранный язык", "Хемоинформатика Практика", "09:50", "Нет: вторник, английский → хемоинформатика."),
  fact("2026-11-17", "Хемоинформатика Практика", "Хемоинформатика Лекция", "11:30", "Тот же корпус: вторник."),
  fact("2026-11-20", "Органическая химия Лекция", "English C1 / Английский язык C1 Иностранный язык", "15:20", "Да: пятница, органика → английский."),
];
const tuesdayMorning = new Date("2026-11-17T07:00:00+03:00");

describe("answerTransfer: «успею ли с X на Y» — из посчитанных переходов", () => {
  it("находит переход по падежным формам названий и дню недели", () => {
    expect(answerTransfer("Успею ли я во вторник с английского на хемоинформатику?", facts, tuesdayMorning)).toBe(facts[0].text);
    expect(answerTransfer("Успею с органики на английский?", facts, tuesdayMorning)).toBe(facts[2].text);
    expect(answerTransfer("успею ли сегодня с пары по английскому на лекцию по хемоинформатике", facts, tuesdayMorning)).toBe(facts[0].text);
    expect(answerTransfer("Успеваю дойти от иностранного до хемоинформатики?", facts, tuesdayMorning)).toBe(facts[0].text);
    expect(answerTransfer("Не опоздаю завтра? Нет, сегодня: успеем с английского на хемоинформатику?", facts, tuesdayMorning)).toBeNull();
  });

  it("не тот переход не подставляет: «с английского» ≠ «на английский» (живой сайт 17.11)", () => {
    expect(answerTransfer("Успею ли с хемоинформатики на английский?", facts, tuesdayMorning)).toBeNull();
    expect(answerTransfer("Успею в пятницу с английского на хемоинформатику?", facts, tuesdayMorning)).toBeNull();
  });

  it("без вопроса «успею», без обеих пар или с незнакомой парой — отвечает модель", () => {
    expect(answerTransfer("С английского на хемоинформатику далеко?", facts, tuesdayMorning)).toBeNull();
    expect(answerTransfer("Успею на хемоинформатику?", facts, tuesdayMorning)).toBeNull();
    expect(answerTransfer("Успею ли с физры на биохимию?", facts, tuesdayMorning)).toBeNull();
  });

  it("о другом человеке и с непонятной датой — к модели, не ближайший день (ревью Codex 73)", () => {
    for (const q of [
      "Успеет ли Тимур во вторник с английского на хемоинформатику?",
      "Успею ли в следующий вторник с английского на хемоинформатику?",
      "Успею 24 ноября с английского на хемоинформатику?",
      "Успею ли послезавтра с английского на хемоинформатику?",
      "Успею ли через неделю с английского на хемоинформатику?",
      "Успел бы я в прошлый вторник? Успею ли в прошлый вторник с английского на хемоинформатику?",
      "Успею ли во вторник и пятницу с английского на хемоинформатику?",
    ]) {
      expect(answerTransfer(q, facts, tuesdayMorning), q).toBeNull();
    }
  });

  it("не первый вопрос в разговоре: без дня в самом вопросе — к модели, с днём — ответ сервера (ревью Codex 75)", () => {
    expect(answerTransfer("Успею с английского на хемоинформатику?", facts, tuesdayMorning, false)).toBeNull();
    expect(answerTransfer("А во вторник успею с английского на хемоинформатику?", facts, tuesdayMorning, false)).toBe(facts[0].text);
  });

  it("день не назван — ближайший предстоящий переход", () => {
    const twice = [...facts, fact("2026-11-23", "English C1 / Английский язык C1", "Хемоинформатика", "09:50", "Нет: следующий вторник.")];
    const tuesdayNoon = new Date("2026-11-17T12:00:00+03:00");
    expect(answerTransfer("Успею с английского на хемоинформатику?", twice, tuesdayNoon)).toBe("Нет: следующий вторник.");
    expect(answerTransfer("Успею с английского на хемоинформатику?", twice, tuesdayMorning)).toBe(facts[0].text);
  });
});
