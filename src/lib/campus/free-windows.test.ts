import { describe, expect, it } from "vitest";
import { freeWindows } from "./free-windows";

const s = (...xs: string[]) => xs.map((start) => ({ start }));

describe("свободные окна аудитории", () => {
  it("соседние получасовые слоты склеиваются, разрыв — новое окно", () => {
    expect(freeWindows(s("10:00", "10:30", "11:00", "14:00", "14:30"))).toEqual(["10:00–11:30", "14:00–15:00"]);
  });
  it("один слот — окно на полчаса; порядок и повторы не важны; пусто — пусто", () => {
    expect(freeWindows(s("20:30"))).toEqual(["20:30–21:00"]);
    expect(freeWindows(s("09:30", "09:00", "09:00"))).toEqual(["09:00–10:00"]);
    expect(freeWindows([])).toEqual([]);
  });
});
