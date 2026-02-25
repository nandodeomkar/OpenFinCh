import os
import re

with open('openfinch/stock_chart.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

def clean(lines_list):
    res = []
    for line in lines_list:
        # We only want to unescape {{ and }} if this was an f-string, but this is the raw string from python file.
        # Wait, the python file has actual '{{' and '}}' string literals. 
        # But it also has `{default_symbol}` and `{interval_options_html}`.
        # If we replace {{ with {, we MUST NOT replace {default_symbol} with anything that breaks.
        res.append(line.replace('{{', '{').replace('}}', '}'))
    return "".join(res)

css_lines = lines[24:778] # 0-indexed: line 25 is index 24.
html_lines = lines[781:1022] # 0-indexed: 782 is index 781.

with open('openfinch/frontend/css/styles.css', 'w', encoding='utf-8') as f:
    f.write(clean(css_lines))

with open('openfinch/frontend/html/layout.html', 'w', encoding='utf-8') as f:
    f.write(clean(html_lines))

# For JS, let's just dump ALL JS into a single string first.
js_lines = lines[1024:4343]
js_cleaned = clean(js_lines).split('\n')

js_modules = {
    'core.js': [],
    'ui.js': [],
    'drawings.js': [],
    'color_picker.js': [],
    'indicators.js': [],
    'data_panel.js': []
}

current_module = 'core.js'

for line in js_cleaned:
    if '// ========== STATE ==========' in line: current_module = 'core.js'
    elif '// ========== TIMEZONE STATE ==========' in line: current_module = 'core.js'
    elif '// ========== CHART SETUP ==========' in line: current_module = 'core.js'
    elif '// ========== DATA LOADING ==========' in line: current_module = 'core.js'
    elif '// ========== TICKER INPUT + AUTOCOMPLETE ==========' in line: current_module = 'ui.js'
    elif '// ========== INTERVAL DROPDOWN ==========' in line: current_module = 'ui.js'
    elif '// ========== CUSTOM INTERVAL ==========' in line: current_module = 'ui.js'
    elif '// ========== CHART TYPE ==========' in line: current_module = 'ui.js'
    elif '// ========== OHLC LEGEND ==========' in line: current_module = 'ui.js'
    elif '// ========== DRAWING TOOLS ==========' in line: current_module = 'drawings.js'
    elif '// ========== COLOR PICKER IMPLEMENTATION ==========' in line: current_module = 'color_picker.js'
    elif '// ========== MULTI-PANE SYSTEM ==========' in line: current_module = 'core.js'
    elif '// ========== INDICATORS PANEL ==========' in line: current_module = 'indicators.js'
    elif '// ========== SMA CALCULATION ==========' in line: current_module = 'indicators.js'
    # All indicators below will fall under indicators.js
    elif '// ========== CLOCK & TIMEZONE ==========' in line: current_module = 'ui.js'
    elif '// ========== DATA PANEL' in line: current_module = 'data_panel.js'
    elif '// ========== DRAWING EVENT HANDLERS ==========' in line: current_module = 'drawings.js'
    elif 'const dataPanelResizer =' in line: current_module = 'data_panel.js'
    elif '// ========== INIT ==========' in line: current_module = 'core.js'
    
    js_modules[current_module].append(line)

for mod_name, m_lines in js_modules.items():
    with open(f'openfinch/frontend/js/{mod_name}', 'w', encoding='utf-8') as f:
        f.write("\n".join(m_lines))

print("Extraction completed.")
