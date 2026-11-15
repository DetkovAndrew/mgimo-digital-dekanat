import { describe, expect, it } from "vitest";
import { roomOnMapHref, searchRooms, type RoomIndexItem } from "./search";

const room = (p: Partial<RoomIndexItem> & Pick<RoomIndexItem, "number">): RoomIndexItem => ({
  buildingId: "kronv",
  short: "ГК",
  building: "Главный корпус",
  floor: Number(p.number[1]),
  kind: "Аудитория",
  title: null,
  bookable: false,
  ...p,
});

const INDEX = [
  room({ number: "1101" }),
  room({ number: "1117", kind: "Коворкинг", title: "Атриум", bookable: true }),
  room({ number: "1206", kind: "Переговорная", bookable: true }),
  room({ number: "1101", buildingId: "lom-m", short: "М", building: "Корпус на Ломоносова" }),
  room({ number: "2337" }),
];

describe("поиск аудиторий", () => {
  it("цифры — начало номера; полный номер из двух корпусов — оба", () => {
    expect(searchRooms(INDEX, "11").map((r) => r.number)).toEqual(["1101", "1101", "1117"]);
    expect(searchRooms(INDEX, "1101").map((r) => r.short)).toEqual(["ГК", "М"]);
    expect(searchRooms(INDEX, "37")).toEqual([]); // середина номера не считается
  });

  it("слова — по названию, типу и корпусу, без учёта регистра и ё; все слова сразу", () => {
    expect(searchRooms(INDEX, "атриум").map((r) => r.number)).toEqual(["1117"]);
    expect(searchRooms(INDEX, "ПЕРЕГ").map((r) => r.number)).toEqual(["1206"]);
    expect(searchRooms(INDEX, "1101 м").map((r) => r.short)).toEqual(["М"]);
    expect(searchRooms(INDEX, "   ")).toEqual([]);
  });

  it("ссылка ведёт на схему корпуса с выбранной аудиторией", () => {
    expect(roomOnMapHref({ buildingId: "kronv", number: "1117" })).toBe("/rooms/kronv?room=1117#room");
  });
});
