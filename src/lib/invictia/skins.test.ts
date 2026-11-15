import { describe, expect, it } from "vitest";
import { HAIR, isSkinUnlocked, SKINS, skinById } from "./skins";

const none = { excellent: false, invicta: false, sport60: false, sport100: false, booker: false, travel: false };

describe("образы Инвиктии", () => {
  it("уникальные id из латиницы (как требует CHECK в БД), сдвиги волос — существующих кружочков", () => {
    expect(new Set(SKINS.map((s) => s.id)).size).toBe(SKINS.length);
    for (const s of SKINS) {
      expect(s.id).toMatch(/^[a-z]{1,32}$/);
      for (const i of Object.keys(s.hairPos ?? {})) expect(Number(i)).toBeLessThan(HAIR.length);
      if (s.hair) expect(s.hair).toHaveLength(HAIR.length);
      if (s.unlock) expect(s.hint, s.id).not.toBe("");
    }
  });

  it("базовый открыт всегда, сезонные — нет, остальные — по своей ачивке", () => {
    expect(SKINS.filter((s) => isSkinUnlocked(s, none)).map((s) => s.id)).toEqual(["base"]);
    expect(isSkinUnlocked(skinById("cat"), { ...none, booker: true })).toBe(true);
    expect(isSkinUnlocked(skinById("newyear"), { ...none, excellent: true, booker: true, sport100: true })).toBe(false);
    expect(skinById("нет такого").id).toBe("base");
    expect(skinById(null).id).toBe("base");
  });
});
