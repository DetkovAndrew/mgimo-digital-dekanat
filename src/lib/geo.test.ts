import { describe, expect, it } from "vitest";
import { distanceMeters, judgeTransfer, yandexRouteUrl } from "./geo";

const a = { id: "a", lat: 59.9566, lon: 30.3101 };
const near = { id: "b", lat: 59.9576, lon: 30.3121 }; // ~150 м
const far = { id: "c", lat: 59.9265, lon: 30.3383 }; // ~3.8 км

describe("geo", () => {
  it("считает расстояние по прямой", () => {
    expect(distanceMeters(a, far)).toBeGreaterThan(3500);
    expect(distanceMeters(a, far)).toBeLessThan(4200);
  });

  it("один корпус — переход не нужен", () => {
    expect(judgeTransfer(a, { ...a }, 10).kind).toBe("same-building");
  });

  it("соседний корпус за 10 минут — пешком", () => {
    expect(judgeTransfer(a, near, 10)).toMatchObject({ kind: "ok", mode: "walk" });
  });

  it("далёкий корпус за 10 минут — не успеть", () => {
    expect(judgeTransfer(a, far, 10).kind).toBe("impossible");
  });

  it("далёкий корпус за большой перерыв — транспортом", () => {
    expect(judgeTransfer(a, far, 50)).toMatchObject({ kind: "ok", mode: "transit" });
  });

  it("ссылка-маршрут от текущего места без ключа", () => {
    expect(yandexRouteUrl(far, "pd")).toBe("https://yandex.ru/maps/?rtext=~59.9265,30.3383&rtt=pd");
  });
});

describe("литеры одного корпуса", () => {
  it("переход занимает минимум 3 минуты", () => {
    const litA = { id: "lom-a", lat: 59.9273, lon: 30.3384 };
    const litM = { id: "lom-m", lat: 59.92735, lon: 30.33855 };
    expect(judgeTransfer(litA, litM, 10)).toMatchObject({ kind: "ok", mode: "walk", estimate: { walkMin: 3 } });
  });
});
