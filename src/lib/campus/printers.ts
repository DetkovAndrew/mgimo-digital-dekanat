import { PLANS } from "./plans";

// Принтеры печати по коду (демо): стоят у коворкингов и деканата, комнаты — со схем корпусов.
// Статусы постоянные, чтобы жюри увидело все состояния: «работает», «мало тонера» (печатает), «нет бумаги» (нет).

export type PrinterStatus = "ok" | "low" | "paper";
export type Printer = { id: string; title: string; buildingId: string; room: string; floor: number; color: boolean; status: PrinterStatus };

export const PRINTERS: readonly Printer[] = [
  { id: "kronv-atrium", title: "Коворкинг «Атриум»", buildingId: "kronv", room: "2101", floor: 1, color: true, status: "ok" },
  { id: "kronv-dean", title: "У деканата", buildingId: "kronv", room: "1117", floor: 1, color: false, status: "low" },
  { id: "kronv-quiet", title: "Тихая зона", buildingId: "kronv", room: "3310", floor: 3, color: false, status: "paper" },
  { id: "lom-kolba", title: "Коворкинг «Колба»", buildingId: "lom-m", room: "1101", floor: 1, color: true, status: "ok" },
];

export const printerStatusLabel: Record<PrinterStatus, { label: string; tone: "ok" | "warn" | "bad" }> = {
  ok: { label: "Работает", tone: "ok" },
  low: { label: "Мало тонера", tone: "warn" },
  paper: { label: "Нет бумаги", tone: "bad" },
};

export const printerById = (id: string) => PRINTERS.find((p) => p.id === id);
export const buildingTitle = (buildingId: string) => PLANS.find((p) => p.buildingId === buildingId)?.title ?? buildingId;
/** Ссылка на комнату на схеме корпуса: оттуда же строится маршрут. */
export const printerLink = (p: Printer) => `/rooms/${p.buildingId}?room=${p.room}#room`;

/** Почему задание нельзя напечатать на этом принтере (null — можно). */
export function printerProblem(p: Printer, job: { color: boolean }): string | null {
  if (p.status === "paper") return "В принтере нет бумаги";
  if (job.color && !p.color) return "Этот принтер печатает только чёрно-белым";
  return null;
}
