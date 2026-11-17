"""Первая страница PDF справки → PNG шириной 724 px для кадра телефона. QR-код и адрес проверки размываются:
токен в них — секрет справки (AGENTS.md). Печатает JSON: адрес проверки (для съёмки страницы проверки) и номер.

    python3 pdf-still.py certificate.pdf certificate.png
"""

import json
import re
import sys
from collections import Counter

import pymupdf
from PIL import Image, ImageFilter

src, dst = sys.argv[1], sys.argv[2]
page = pymupdf.open(src)[0]
text = page.get_text()
url = re.search(r"https?://\S*?/verify/[A-Za-z0-9_-]{10,}", text.replace("\n", "")).group(0)
token = url.rsplit("/", 1)[1]
number = re.search(r"С-\d{6}", text).group(0)

# Модули QR — одинаковые мелкие квадраты (самый частый размер); их общая рамка и есть QR.
squares = [d["rect"] for d in page.get_drawings() if d.get("fill") and d["rect"].width < 6 and abs(d["rect"].width - d["rect"].height) < 0.05]
module = Counter(round(r.width, 2) for r in squares).most_common(1)[0][0]
cells = [r for r in squares if abs(r.width - module) < 0.02]
qr = pymupdf.Rect(cells[0])
for r in cells[1:]:
    qr |= r
# Строки адреса: с «/verify/» и продолжения токена при переносе.
spans = [s for b in page.get_text("dict")["blocks"] for l in b.get("lines", []) for s in l["spans"]]
hide = [qr] + [pymupdf.Rect(s["bbox"]) for s in spans if "/verify/" in s["text"] or (len(s["text"].strip()) >= 4 and s["text"].strip() in token)]

zoom = 724 / page.rect.width
pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom))
img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
for r in hide:
    box = tuple(int(v * zoom) for v in (r.x0 - 3, r.y0 - 2, r.x1 + 3, r.y1 + 2))
    part = img.crop(box)
    small = part.resize((max(1, part.width // 10), max(1, part.height // 10)), Image.BILINEAR)
    img.paste(small.resize(part.size, Image.BILINEAR).filter(ImageFilter.GaussianBlur(3)), box)
img.save(dst)
print(json.dumps({"url": url, "number": number, "hidden": len(hide)}))
