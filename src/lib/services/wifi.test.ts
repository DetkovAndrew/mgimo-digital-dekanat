import { describe, expect, it } from "vitest";
import { wifiQrPayload } from "./wifi";

describe("Wi-Fi", () => {
  it("QR-строка экранирует служебные символы", () => {
    expect(wifiQrPayload("University Guest", "abcd-2345")).toBe("WIFI:T:WPA;S:University Guest;P:abcd-2345;;");
    expect(wifiQrPayload('a;b,c:d"e\\f', "p")).toBe('WIFI:T:WPA;S:a\\;b\\,c\\:d\\"e\\\\f;P:p;;');
  });
});
