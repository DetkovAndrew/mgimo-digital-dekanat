# Шрифты для отчёта и превью знака

Шрифты в репозитории не хранятся. `scripts/render-report.py` и `scripts/brand-assets.py` берут кириллический шрифт
из системы: DejaVu Sans (`/usr/share/fonts/truetype/dejavu/`, пакет `fonts-dejavu-core`, свободная лицензия
Bitstream Vera / DejaVu) или пути из `REPORT_FONT_REGULAR` и `REPORT_FONT_BOLD`.

Прежние файлы Liberation Sans 1.07.4 удалены при слиянии 14.11: это версия под GPLv2 с исключением, а не OFL,
как было указано (ревью Codex 51). Правила проекта допускают только разрешительные лицензии.
