# Onest для PDF-справки

Шрифт Onest (SIL Open Font License 1.1, текст лицензии — `OFL.txt`), Copyright 2021 The Onest Project Authors
(https://github.com/googlefonts/onest). Интерфейс получает тот же шрифт через `next/font`; здесь — статические TTF
для встраивания в PDF (`src/server/documents/pdf.ts`, pdf-lib встраивает подмножество глифов).

| Файл | Начертание | Источник (Google Fonts, v11, 14.11.2026) | SHA-256 |
|---|---|---|---|
| `Onest-Regular.ttf` | 400 | `fonts.gstatic.com/s/onest/v11/gNMZW3F-SZuj7zOT0IfSjTS16cPh9R-Zsg.ttf` | `5d27bd7fe4b79e94bbe64e7eed75a2ab9921dd603b2cf02ceb9a19150de48f2c` |
| `Onest-SemiBold.ttf` | 600 | `fonts.gstatic.com/s/onest/v11/gNMZW3F-SZuj7zOT0IfSjTS16cPhKxiZsg.ttf` | `030d1bae9b38f45a1d821bf9d76006450982b41c3ab96cd0c72960e01e674436` |

Файлы — статические инстансы (без таблицы `fvar`), с кириллицей и знаком «№»: проверено fontkit при добавлении.
