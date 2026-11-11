"""Render the original mark.svg geometry with Pillow. Run from the repository root.

Development-only tool; does not add Python or Pillow to application dependencies.
SVG coordinates below intentionally match public/brand/mark.svg.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public" / "brand"
BLUE = "#3b4cca"


def cubic(p0, p1, p2, p3):
    return [tuple((1-t)**3*p0[i] + 3*(1-t)**2*t*p1[i]
                  + 3*(1-t)*t*t*p2[i] + t**3*p3[i] for i in (0, 1))
            for t in (n/64 for n in range(1, 65))]


def mark(size):
    scale = size * 4 / 64
    canvas = Image.new("RGBA", (size*4, size*4), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((0, 0, 64*scale-1, 64*scale-1), radius=16*scale, fill=BLUE)
    points = [(14, 14), (23, 14), (23, 35)]
    points += cubic((23, 35), (23, 42), (27, 46), (32, 46))
    points += cubic((32, 46), (37, 46), (41, 42), (41, 35))
    points += [(41, 27), (50, 27), (50, 35)]
    points += cubic((50, 35), (50, 47), (43, 55), (32, 55))
    points += cubic((32, 55), (21, 55), (14, 47), (14, 35))
    draw.polygon([(x*scale, y*scale) for x, y in points], fill="white")
    draw.rounded_rectangle((41*scale, 12*scale, 50*scale, 21*scale), radius=2*scale, fill="white")
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    for size in (32, 192, 512):
        mark(size).save(DEST / f"icon-{size}.png")
    apple = Image.new("RGB", (180, 180), BLUE)
    apple.paste(mark(180), mask=mark(180).getchannel("A"))
    apple.save(DEST / "apple-touch-icon.png")
    # Save a real multi-resolution ICO, replacing the Next starter favicon.
    mark(64).save(DEST / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    (ROOT / "src/app/favicon.ico").write_bytes((DEST / "favicon.ico").read_bytes())
    preview = Image.new("RGB", (1000, 400), "#f1f4fb")
    d = ImageDraw.Draw(preview)
    font_path = ROOT / "assets/fonts/LiberationSans-Regular.ttf"
    title_font = ImageFont.truetype(str(font_path), 30)
    label_font = ImageFont.truetype(str(font_path), 18)
    d.text((36, 26), "University / Brand assets", font=title_font, fill="#16223c")
    for x, size in ((45, 256), (370, 192), (650, 64), (810, 32)):
        preview.paste(mark(size), (x, 105), mark(size))
        d.text((x, 370), f"{size}px", font=label_font, fill="#384460")
    preview.save(DEST / "preview.png")
    for size in (32, 192, 512):
        with Image.open(DEST / f"icon-{size}.png") as image:
            assert image.size == (size, size)
    with Image.open(DEST / "favicon.ico") as icon:
        assert icon.ico.sizes() == {(16, 16), (32, 32), (48, 48)}
    print("Brand assets generated; PNG dimensions and ICO frames verified.")


if __name__ == "__main__":
    main()
