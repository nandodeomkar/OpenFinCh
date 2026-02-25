import re
import os
import subprocess

# 1. Get the original stock_chart.py from git HEAD
try:
    mono_content = subprocess.check_output(
        ['git', 'show', 'HEAD:openfinch/stock_chart.py'],
        text=True, encoding='utf-8', errors='ignore'
    )
except subprocess.CalledProcessError as e:
    print(f"Error fetching original stock_chart.py from git: {e}")
    exit(1)

# 2. We don't overwrite css/layout.html since those were extracted fine earlier.
# We focus on the <script> block. Let's find the content between <script> and </script>
# 2. We focus on the <script> block. Let's find the content after the second <script>
script_parts = mono_content.split('<script>')
if len(script_parts) < 2:
    print("Could not find <script> block in monolithic file")
    exit(1)

# The second <script> will be script_parts[-1], which ends with </script>
js_content = script_parts[-1].split('</script>')[0]

def clean(text):
    # Unescape python f-string {{ }}
    return text.replace('{{', '{').replace('}}', '}')

js_cleaned = clean(js_content).split('\n')

js_modules = {
    'core.js': [],
    'ui.js': [],
    'drawings.js': [],
    'color_picker.js': [],
    'indicators.js': [],
    'data_panel.js': [],
    'init.js': []
}

# 3. Smart routing based on headers
current_module = 'core.js'

for line in js_cleaned:
    # State belongs in core.js and MUST NOT be skipped
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
    elif '// ========== DRAWING EVENT HANDLERS ==========' in line: current_module = 'drawings.js'
    elif '// ========== COLOR PICKER IMPLEMENTATION ==========' in line: current_module = 'color_picker.js'
    elif '// ========== MULTI-PANE SYSTEM ==========' in line: current_module = 'core.js'
    elif '// ========== INDICATORS PANEL ==========' in line: current_module = 'indicators.js'
    elif '// ========== INDICATOR MANAGEMENT ==========' in line: current_module = 'indicators.js'
    elif '// ========== SMA CALCULATION ==========' in line: current_module = 'indicators.js'
    elif '// ========== EMA CALCULATION ==========' in line: current_module = 'indicators.js'
    elif '// ========== ATR CALCULATION ==========' in line: current_module = 'indicators.js'
    elif '// ========== MACD CALCULATION ==========' in line: current_module = 'indicators.js'
    elif '// ========== VWMA CALCULATION ==========' in line: current_module = 'indicators.js'
    elif '// ========== BOLLINGER BANDS CALCULATION ==========' in line: current_module = 'indicators.js'
    elif '// ========== ADX CALCULATION ==========' in line: current_module = 'indicators.js'
    elif '// ========== AROON CALCULATION ==========' in line: current_module = 'indicators.js'
    elif '// ========== END INDICATORS ==========' in line: current_module = 'ui.js' # Go back to UI if there are tools after indicators
    elif '// ========== CLOCK & TIMEZONE ==========' in line: current_module = 'ui.js'
    elif '// ========== UNIFIED DATA PANEL ==========' in line: current_module = 'data_panel.js'
    elif 'const dataPanelResizer =' in line: current_module = 'data_panel.js'
    elif '// ========== AUTO-DETECT LOCAL INDEX ==========' in line: current_module = 'init.js'
    elif '// ========== INIT ==========' in line: current_module = 'init.js'
    
    js_modules[current_module].append(line)

os.makedirs('openfinch/frontend/js', exist_ok=True)

for mod_name, m_lines in js_modules.items():
    with open(f'openfinch/frontend/js/{mod_name}', 'w', encoding='utf-8') as f:
        f.write("\n".join(m_lines))

print("JS Extraction completed dynamically.")
