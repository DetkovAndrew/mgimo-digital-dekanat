import { describe, expect, it } from "vitest";
import { checkSlot } from "./availability";

const sport = { id: "sport", title: "Спорткомплекс", lat: 59.97263, lon: 30.3025 };
const kronv = { id: "kronv", title: "Кронверкский", lat: 59.95636, lon: 30.31001 };
const lom = { id: "lom-m", title: "Ломоносова", lat: 59.92729, lon: 30.33835 };
const at = (t: string) => new Date(`2026-11-17T${t}:00+03:00`);
const slot = { startsAt: at("15:20"), endsAt: at("16:50"), place: sport };

describe("доступность тренировки", () => {
  it("свободный день — можно", () => {
    expect(checkSlot(slot, [])).toBeNull();
  });

  it("пересечение с парой", () => {
    const r = checkSlot(slot, [{ title: "Физика", startsAt: at("15:00"), endsAt: at("16:30"), place: kronv }]);
    expect(r?.code).toBe("OVERLAP");
  });

  it("с Ломоносова за 20 минут до спорткомплекса не успеть", () => {
    const r = checkSlot(slot, [{ title: "Химия", startsAt: at("13:30"), endsAt: at("15:00"), place: lom }]);
    expect(r?.code).toBe("TRANSFER_BEFORE");
  });

  it("пара в том же корпусе вплотную — нет времени переодеться", () => {
    const r = checkSlot(slot, [{ title: "Лекция", startsAt: at("13:50"), endsAt: at("15:20"), place: sport }]);
    expect(r?.code).toBe("CHANGE_TIME");
  });

  it("после тренировки онлайн-пара не требует перехода", () => {
    expect(checkSlot(slot, [{ title: "Философия", startsAt: at("17:00"), endsAt: at("18:30"), place: null }])).toBeNull();
  });
});
