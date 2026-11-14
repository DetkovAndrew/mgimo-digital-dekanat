import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { degrees, PDFDocument, type PDFFont, type PDFPage, rgb } from "pdf-lib";
import { encode } from "uqr";
import type { CertificateContent } from "@/lib/documents/certificate";
import { formatDate } from "@/lib/format";

// PDF справки об обучении (docs/plans/certificates.md). Рисуется при каждом скачивании из снимка на дату выдачи:
// данные не меняются, байты файла могут отличаться между версиями шаблона. Шрифт Onest (OFL) — assets/fonts/onest.

const FONT_DIR = path.join(process.cwd(), "assets/fonts/onest");
let fontBytes: Promise<[Buffer, Buffer]> | undefined;
const loadFonts = () =>
  (fontBytes ??= Promise.all([
    readFile(path.join(FONT_DIR, "Onest-Regular.ttf")),
    readFile(path.join(FONT_DIR, "Onest-SemiBold.ttf")),
  ]).catch((e) => {
    fontBytes = undefined;
    throw e;
  }));

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
// Светлые токены из globals.css: документ печатается на белом.
const INK = hex("#171b2b");
const INK_2 = hex("#4c5570");
const HAIRLINE = hex("#dfe3ef");
const BRAND = hex("#3b4cca");
const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0, 0, 0);

const A4 = { w: 595.28, h: 841.89 };
const M = 56;
const CONTENT_W = A4.w - 2 * M;

// Знак University (src/components/university-mark.tsx) в координатах 64×64.
const MARK_BG = "M16 0H48A16 16 0 0 1 64 16V48A16 16 0 0 1 48 64H16A16 16 0 0 1 0 48V16A16 16 0 0 1 16 0Z";
const MARK_U = "M14 14H23V35C23 42 27 46 32 46C37 46 41 42 41 35V27H50V35C50 47 43 55 32 55C21 55 14 47 14 35V14Z";
const MARK_DOT = "M43 12H48A2 2 0 0 1 50 14V19A2 2 0 0 1 48 21H43A2 2 0 0 1 41 19V14A2 2 0 0 1 43 12Z";

export const DISCLAIMER =
  "Концепт для конкурса MGIMO AI Challenge 2026. Не является официальным сервисом какого-либо вуза. Все данные вымышлены. " +
  "Документ демонстрационный: не подтверждает обучение в реальном вузе и юридической силы не имеет.";

type Input = { number: string; issuedAt: Date; content: CertificateContent; verifyUrl: string };

export async function renderCertificatePdf({ number, issuedAt, content, verifyUrl }: Input): Promise<Uint8Array> {
  const [regularBytes, boldBytes] = await loadFonts();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(regularBytes, { subset: true });
  const bold = await pdf.embedFont(boldBytes, { subset: true });
  const title = `Справка об обучении ${number}`;
  pdf.setTitle(title);
  pdf.setAuthor("University (демо)");
  pdf.setSubject("Демонстрационный документ конкурса MGIMO AI Challenge 2026");
  pdf.setCreator("Цифровой деканат University");
  pdf.setProducer("Цифровой деканат University");
  pdf.setLanguage("ru-RU");
  pdf.setCreationDate(issuedAt);
  pdf.setModificationDate(issuedAt);

  const page = pdf.addPage([A4.w, A4.h]);
  const t = textTools(regular, bold);

  // Водяной знак первым: текст и QR ложатся поверх, белая подложка QR его перекрывает.
  const mark = "ОБРАЗЕЦ · ДЕМО";
  const markSize = 64;
  const markW = bold.widthOfTextAtSize(mark, markSize);
  const angle = 35;
  const rad = (angle * Math.PI) / 180;
  page.drawText(mark, {
    x: A4.w / 2 - (markW / 2) * Math.cos(rad),
    y: A4.h / 2 - (markW / 2) * Math.sin(rad),
    size: markSize, font: bold, color: BRAND, opacity: 0.07, rotate: degrees(angle),
  });

  // Шапка: знак, название, пометка «образец».
  let y = A4.h - M;
  const markScale = 36 / 64;
  page.drawSvgPath(MARK_BG, { x: M, y, scale: markScale, color: BRAND });
  page.drawSvgPath(MARK_U, { x: M, y, scale: markScale, color: WHITE });
  page.drawSvgPath(MARK_DOT, { x: M, y, scale: markScale, color: WHITE });
  page.drawText("University", { x: M + 48, y: y - 15, size: 15, font: bold, color: INK });
  page.drawText("Цифровой деканат · демонстрационный прототип", { x: M + 48, y: y - 30, size: 9, font: regular, color: INK_2 });
  const badge = "ОБРАЗЕЦ";
  const badgeW = bold.widthOfTextAtSize(badge, 9) + 16;
  page.drawRectangle({ x: A4.w - M - badgeW, y: y - 26, width: badgeW, height: 18, borderColor: BRAND, borderWidth: 1 });
  page.drawText(badge, { x: A4.w - M - badgeW + 8, y: y - 20.5, size: 9, font: bold, color: BRAND });
  y -= 52;
  hairline(page, y);

  y -= 40;
  page.drawText("Справка об обучении", { x: M, y, size: 24, font: bold, color: INK });
  y -= 22;
  page.drawText(`№ ${number} от ${formatDate(issuedAt)}`, { x: M, y, size: 11, font: regular, color: INK_2 });
  y -= 30;
  y = t.paragraph(page, "Настоящая справка подтверждает, что указанное лицо является студентом University по сведениям на дату выдачи.", M, y, CONTENT_W, 11, 16, INK);

  // Таблица полей: подписи слева, значения справа. Склонений нет — пол и падежи не нужны.
  const rows: [string, string][] = [
    ["Студент", content.fullName],
    ["Факультет", content.faculty],
    ["Направление подготовки", content.program],
    ...(content.profile ? [["Профиль", content.profile] as [string, string]] : []),
    ["Уровень образования", content.level],
    ["Курс", String(content.course)],
    ["Группа", content.group],
    ["Форма обучения", content.studyForm],
    ["Основа обучения", content.funding],
    ["Дата зачисления", formatDate(new Date(`${content.enrolledAt}T12:00:00Z`))],
    ["Выдана для предоставления", content.destination],
  ];
  // Высота считается для всей таблицы (ревью Codex 58): таблица не заходит на блок проверки внизу.
  const qrBottom = M + 50;
  const qrSize = 116;
  const tableFloor = qrBottom + qrSize + 20;
  y -= 14;
  hairline(page, y);
  const valueX = M + 180;
  const valueW = CONTENT_W - 180;
  const table = fitTable(t, regular, rows, valueW, y - tableFloor);
  for (const { label, lines } of table.rows) {
    const top = y - 16;
    page.drawText(label, { x: M, y: top, size: 9.5, font: regular, color: INK_2 });
    lines.forEach((line, i) => page.drawText(line, { x: valueX, y: top - i * table.leading, size: table.size, font: regular, color: INK }));
    y = top - (lines.length - 1) * table.leading - 8;
    hairline(page, y);
  }
  if (y < tableFloor) throw new Error("certificate layout overflow");

  // Проверка: QR на белой подложке с тихой зоной в 4 модуля, рядом — адрес и пояснение.
  drawQr(page, verifyUrl, M, qrBottom, qrSize);
  const textX = M + qrSize + 24;
  const textW = CONTENT_W - qrSize - 24;
  let ty = qrBottom + qrSize - 10;
  page.drawText("Проверка по QR-коду", { x: textX, y: ty, size: 11, font: bold, color: INK });
  ty -= 16;
  ty = t.paragraph(page, "Отсканируйте QR-код камерой телефона или откройте адрес:", textX, ty, textW, 9.5, 13, INK_2);
  ty = t.paragraph(page, verifyUrl, textX, ty, textW, 9.5, 13, BRAND);
  ty -= 4;
  ty = t.paragraph(page, "Страница проверки подтверждает, что справка с этим номером есть в демо-реестре University. Сверьте с ней данные документа.", textX, ty, textW, 9.5, 13, INK_2);
  t.paragraph(page, "Документ сформирован в электронном виде. Подпись и печать в демо не ставятся.", textX, ty - 4, textW, 9.5, 13, INK_2);

  hairline(page, M + 30);
  t.paragraph(page, DISCLAIMER, M, M + 18, CONTENT_W, 8, 11, INK_2);

  return pdf.save();
}

type TextTools = ReturnType<typeof textTools>;

/**
 * Значения таблицы целиком, если помещаются: сначала шрифт 11, 10, 9 pt. Крайний случай (поля по 200 символов) —
 * общий предел строк на поле с «…»: полные данные остаются в снимке и на странице проверки.
 */
function fitTable(t: TextTools, font: PDFFont, rows: [string, string][], width: number, available: number) {
  const height = (all: string[][], leading: number) => all.reduce((h, ls) => h + 24 + (ls.length - 1) * leading, 0);
  const result = (size: number, leading: number, all: string[][]) => ({ size, leading, rows: rows.map(([label], i) => ({ label, lines: all[i] })) });
  for (const size of [11, 10, 9]) {
    const leading = Math.round(size * 1.36);
    const all = rows.map(([, value]) => t.lines(value, font, size, width));
    if (height(all, leading) <= available) return result(size, leading, all);
  }
  for (let max = 4; ; max--) {
    const all = rows.map(([, value]) => t.lines(value, font, 9, width, max));
    if (height(all, 12) <= available || max === 1) return result(9, 12, all);
  }
}

function hairline(page: PDFPage, y: number) {
  page.drawLine({ start: { x: M, y }, end: { x: A4.w - M, y }, thickness: 0.75, color: HAIRLINE });
}

function drawQr(page: PDFPage, text: string, x: number, y: number, size: number) {
  const qr = encode(text, { ecc: "M", border: 0 });
  const quiet = 4;
  const cell = size / (qr.size + 2 * quiet);
  page.drawRectangle({ x, y, width: size, height: size, color: WHITE });
  qr.data.forEach((row, r) => {
    // Тёмные модули строки — отрезками: меньше объектов в PDF, без щелей между соседними модулями.
    for (let c = 0; c < row.length; c++) {
      if (!row[c]) continue;
      let end = c;
      while (end + 1 < row.length && row[end + 1]) end++;
      page.drawRectangle({ x: x + (quiet + c) * cell, y: y + size - (quiet + r + 1) * cell, width: (end - c + 1) * cell, height: cell, color: BLACK });
      c = end;
    }
  });
}

/** Перенос строк по ширине, без символов, которых нет в шрифте, и без управляющих символов. */
function textTools(regular: PDFFont, bold: PDFFont) {
  const charsets = new Map<PDFFont, Set<number>>([
    [regular, new Set(regular.getCharacterSet())],
    [bold, new Set(bold.getCharacterSet())],
  ]);
  const clean = (text: string, font: PDFFont) => {
    const known = charsets.get(font)!;
    return Array.from(text.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " "))
      .map((ch) => (known.has(ch.codePointAt(0)!) ? ch : "?"))
      .join("")
      .replace(/\s+/g, " ")
      .trim();
  };
  const fits = (s: string, font: PDFFont, size: number, width: number) => font.widthOfTextAtSize(s, size) <= width;

  /** Слово длиннее строки (адрес, длинное название) режется по символам. */
  const pieces = (word: string, font: PDFFont, size: number, width: number) => {
    if (fits(word, font, size, width)) return [word];
    const out: string[] = [];
    let cur = "";
    for (const ch of Array.from(word)) {
      if (cur && !fits(cur + ch, font, size, width)) {
        out.push(cur);
        cur = ch;
      } else cur += ch;
    }
    return cur ? [...out, cur] : out;
  };

  const lines = (text: string, font: PDFFont, size: number, width: number, max = Infinity) => {
    const out: string[] = [];
    let line = "";
    for (const word of clean(text, font).split(" ")) {
      for (const piece of pieces(word, font, size, width)) {
        const next = line ? `${line} ${piece}` : piece;
        if (fits(next, font, size, width)) line = next;
        else {
          if (line) out.push(line);
          line = piece;
        }
      }
    }
    if (line) out.push(line);
    if (out.length <= max) return out.length ? out : ["не указано"];
    // Длиннее лимита — обрезаем последнюю строку с многоточием, чтобы таблица не наехала на QR.
    let last = out[max - 1];
    while (last && !fits(`${last}…`, font, size, width)) last = Array.from(last).slice(0, -1).join("");
    return [...out.slice(0, max - 1), `${last}…`];
  };

  const paragraph = (page: PDFPage, text: string, x: number, y: number, width: number, size: number, leading: number, color = INK) => {
    const ls = lines(text, regular, size, width);
    ls.forEach((line, i) => page.drawText(line, { x, y: y - i * leading, size, font: regular, color }));
    return y - ls.length * leading;
  };

  return { lines, paragraph };
}
