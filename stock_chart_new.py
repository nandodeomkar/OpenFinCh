"""HTML chart page generator for OpenFinCh.

This module only generates the HTML/CSS/JS for the chart page.
Data is fetched dynamically via AJAX from the local server.
"""

import os
from openfinch.intervals import get_interval_buttons


def build_chart_html(default_symbol: str) -> str:
    """Generate the chart HTML page with an editable ticker and interval toggles."""

    buttons = get_interval_buttons()
    interval_options_html = "\n      ".join(
        f'<option value="{b["key"]}">{b["label"]}</option>'
        for b in buttons
    )
    default_interval = "1d"

    frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
    
    with open(os.path.join(frontend_dir, "css", "styles.css"), "r", encoding="utf-8") as f:
        styles_css = f.read()

    with open(os.path.join(frontend_dir, "html", "layout.html"), "r", encoding="utf-8") as f:
        layout_html = f.read()

    js_files = ["core.js", "ui.js", "drawings.js", "color_picker.js", "indicators.js", "data_panel.js", "init.js"]
    js_content = ""
    for js_f in js_files:
        with open(os.path.join(frontend_dir, "js", js_f), "r", encoding="utf-8") as f:
            js_content += f.read() + "\n"

    # Inject variables
    layout_html = layout_html.replace("{default_symbol}", default_symbol)
    layout_html = layout_html.replace("{interval_options_html}", interval_options_html)

    js_content = js_content.replace("{default_interval}", default_interval)
    js_content = js_content.replace("{default_symbol}", default_symbol)

    template = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>__TITLE_PLACEHOLDER__ — OpenFinCh</title>
<style>
__CSS_PLACEHOLDER__
</style>
</head>
<body>
__HTML_PLACEHOLDER__
<script src="https://unpkg.com/lightweight-charts@4/dist/lightweight-charts.standalone.production.js"></script>
<script>
__JS_PLACEHOLDER__
</script>
</body>
</html>
"""

    return template.replace("__TITLE_PLACEHOLDER__", default_symbol) \
                   .replace("__CSS_PLACEHOLDER__", styles_css) \
                   .replace("__HTML_PLACEHOLDER__", layout_html) \
                   .replace("__JS_PLACEHOLDER__", js_content)
