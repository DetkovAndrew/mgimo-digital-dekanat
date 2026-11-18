import { foldLine, icsText } from "./ics";

// Контакт службы из «Куда обратиться» (vCard 3.0 — его понимают «Контакты» iPhone и Android).
// Экранирование то же, что в iCalendar: «\ ; ,» и переводы строк.

export type VCardInput = { org: string; name: string; email: string; address: string; note?: string; url?: string };

export function buildVCard(c: VCardInput): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${icsText(c.name)}`,
    `N:;${icsText(c.name)};;;`,
    `ORG:${icsText(c.org)};${icsText(c.name)}`,
    `EMAIL;TYPE=INTERNET,WORK:${icsText(c.email)}`,
    // Адрес целиком — в поле «улица»: так его показывает и открывает в картах любой телефон.
    `ADR;TYPE=WORK:;;${icsText(c.address)};Санкт-Петербург;;;Россия`,
  ];
  if (c.note) lines.push(`NOTE:${icsText(c.note)}`);
  if (c.url) lines.push(`URL:${icsText(c.url)}`);
  lines.push("END:VCARD");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
