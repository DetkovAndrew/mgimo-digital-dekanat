import { isRequestType, requestCatalog } from "./catalog";

// Предзаполнение формы заявки из ссылки (например, от помощника): только поля этого типа,
// значение select — из его вариантов, текст — до 100 символов. Отправку студент делает сам,
// сервер проверяет данные схемой как обычно.

export const PREFILL_TEXT_MAX = 100;

export function prefillFor(type: string, params: Iterable<[string, string]>): Record<string, string> | null {
  if (!isRequestType(type)) return null;
  const fields = new Map<string, (typeof requestCatalog)[typeof type]["fields"][number]>(requestCatalog[type].fields.map((f) => [f.name, f]));
  const out: Record<string, string> = {};
  for (const [key, raw] of params) {
    if (key === "type") continue;
    const f = fields.get(key);
    const value = raw.trim();
    if (!f || key in out || !value) return null;
    if (f.kind === "select") {
      if (!f.options?.some((o) => o.value === value)) return null;
    } else if (f.kind === "text" || f.kind === "textarea") {
      if (value.length > PREFILL_TEXT_MAX || /[\u0000-\u001f]/.test(value)) return null;
    } else if (f.kind === "number") {
      if (!/^\d{1,3}$/.test(value)) return null;
    } else return null;
    out[key] = value;
  }
  return out;
}
