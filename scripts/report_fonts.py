"""Кириллический шрифт для отчёта и превью знака: из системы или из переменных окружения (assets/fonts/README.md)."""
import os
from pathlib import Path

CANDIDATES = {
    "regular": ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "C:/Windows/Fonts/DejaVuSans.ttf"],
    "bold": ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "C:/Windows/Fonts/DejaVuSans-Bold.ttf"],
}


def font_path(style: str) -> str:
    env = os.environ.get(f"REPORT_FONT_{style.upper()}")
    for path in ([env] if env else []) + CANDIDATES[style]:
        if path and Path(path).is_file():
            return path
    raise SystemExit(f"Не найден шрифт ({style}): установите fonts-dejavu-core или задайте REPORT_FONT_{style.upper()}")
