import { describe, expect, it } from "vitest";
import { roomDayKeys } from "@/lib/campus/rules";
import { canonicalLink } from "./links";

const known = new Set(["/grades", "/lessons/abc"]);
const d = roomDayKeys()[1];

describe("canonicalLink: шаблоны ссылок помощника", () => {
  it("аудитория: известный корпус, номер со схемы, дата в окне — канонический вид с якорем", () => {
    expect(canonicalLink(`/rooms/kronv?d=${d}&room=2101`, known)).toBe(`/rooms/kronv?room=2101&d=${d}#room`);
    // Та же ссылка из снимка нормализуется так же (ревью Codex 19).
    expect(canonicalLink(`/rooms/kronv?room=2101&d=${d}`, new Set([`/rooms/kronv?room=2101&d=${d}`]))).toBe(`/rooms/kronv?room=2101&d=${d}#room`);
  });

  it("аудитория: чужой корпус, нет такой аудитории, дата вне окна, лишние или повторные параметры — отказ", () => {
    for (const href of [
      `/rooms/grivc?room=466&d=${d}`,
      `/rooms/kronv?room=9999&d=${d}`,
      "/rooms/kronv?room=2101&d=2030-01-01",
      `/rooms/kronv?room=2101&d=${d}&x=1`,
      `/rooms/kronv?room=2101&room=2104`,
      `/rooms/kronv?room=2101#evil`,
    ]) {
      expect(canonicalLink(href, known)).toBeNull();
    }
  });

  it("заявка с полями: только поля каталога и допустимые значения", () => {
    expect(canonicalLink("/requests/new?type=study_certificate&destination=военкомат&format=paper", known)).toBe(
      `/requests/new?${new URLSearchParams({ type: "study_certificate", destination: "военкомат", format: "paper" })}`,
    );
    for (const href of [
      "/requests/new?type=study_certificate&format=evil",
      "/requests/new?type=study_certificate&studentId=x",
      "/requests/new?type=nope",
      `/requests/new?type=study_certificate&destination=${"а".repeat(101)}`,
    ]) {
      expect(canonicalLink(href, known)).toBeNull();
    }
  });

  it("остальные пути — только точные из снимка", () => {
    expect(canonicalLink("/grades", known)).toBe("/grades");
    expect(canonicalLink("/lessons/other", known)).toBeNull();
    expect(canonicalLink("//evil.example", known)).toBeNull();
  });
});
