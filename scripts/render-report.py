"""Render the editable submission draft to a Unicode PDF with ReportLab.

Run from the project root with Python + reportlab + Pillow. Poppler is used
separately to visually verify output. These are development tools only.
"""
import re
import sys
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Image, KeepTogether

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from report_fonts import font_path  # noqa: E402

for name, style in (("Body", "regular"), ("BodyBold", "bold")):
    pdfmetrics.registerFont(TTFont(name, font_path(style)))
pdfmetrics.registerFontFamily("Body", normal="Body", bold="BodyBold", italic="Body", boldItalic="BodyBold")
BLUE = colors.HexColor("#3b4cca")
styles = {
    "body": ParagraphStyle("Body", fontName="Body", fontSize=10.5, leading=15.7, textColor=colors.HexColor("#27324b"), spaceAfter=10),
    "title": ParagraphStyle("Title", fontName="BodyBold", fontSize=30, leading=36, textColor=BLUE, spaceAfter=22),
    "heading": ParagraphStyle("Heading", fontName="BodyBold", fontSize=19, leading=25, textColor=BLUE, spaceBefore=10, spaceAfter=16, keepWithNext=True),
    "bullet": ParagraphStyle("Bullet", fontName="Body", fontSize=10.5, leading=15.4, leftIndent=13, firstLineIndent=-10, spaceAfter=9),
    "caption": ParagraphStyle("Caption", fontName="Body", fontSize=9, leading=13, textColor=colors.HexColor("#68748b"), spaceAfter=12),
}


def inline(text):
    text = escape(text.replace("\u2011", "-").replace("—", "-").replace("–", "-"))
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    return text


def footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(colors.HexColor("#dde2f1"))
    canvas.line(48, height-38, width-48, height-38)
    canvas.setFont("Body", 8)
    canvas.setFillColor(colors.HexColor("#68748b"))
    canvas.drawString(48, height-29, "UNIVERSITY / MGIMO AI CHALLENGE 2026")
    canvas.drawString(48, 26, "ЧЕРНОВИК / 11.11.2026 / требуется дополнение доказательствами")
    canvas.drawRightString(width-48, 26, str(doc.page))
    canvas.restoreState()


def main():
    output = ROOT / "output/pdf/university-process-draft.pdf"
    output.parent.mkdir(parents=True, exist_ok=True)
    source = (ROOT / "docs/submission/report.md").read_text(encoding="utf-8")
    story, buffer = [], []

    def flush():
        if buffer:
            story.append(Paragraph(inline(" ".join(buffer)), styles["body"]))
            buffer.clear()

    for line in source.splitlines():
        if not line.strip():
            flush()
        elif line == "---":
            flush()
            story.append(PageBreak())
        elif line.startswith("# "):
            flush()
            story.append(Paragraph(inline(line[2:]), styles["title"]))
        elif line.startswith("## "):
            flush()
            story.append(Paragraph(inline(line[3:]), styles["heading"]))
        elif line.startswith("!["):
            flush()
            match = re.fullmatch(r"!\[(.*?)\]\((.*?)\)", line)
            if not match:
                raise ValueError("Invalid image line")
            path = (ROOT / "docs/submission" / match[2]).resolve()
            from PIL import Image as PillowImage
            with PillowImage.open(path) as img:
                width, height = img.size
            story.append(KeepTogether([Image(str(path), width=490, height=490*height/width), Spacer(1, 7), Paragraph(inline(match[1]), styles["caption"])]))
        elif line.startswith("- "):
            flush()
            story.append(Paragraph("- " + inline(line[2:]), styles["bullet"]))
        else:
            buffer.append(line.strip())
    flush()
    doc = SimpleDocTemplate(str(output), pagesize=A4, rightMargin=48, leftMargin=48,
                            topMargin=55, bottomMargin=48, title="University: процесс создания (черновик)",
                            author="University prototype team")
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(f"Draft PDF created: {output}")


if __name__ == "__main__":
    main()
