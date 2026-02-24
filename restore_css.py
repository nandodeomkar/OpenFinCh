import sys
import re

with open('temp_stock_chart.py', 'r', encoding='utf-8') as f:
    text_old = f.read()

# I need to extract from temp_stock_chart.py the missing CSS:
# Starts from #chart-type to #toast.show {{ display: block; }}
pattern_extract = re.compile(
    r'(\s+#chart-area\s*\{\{.*?\s+#toast\.show\s*\{\{\s*display:\s*block;\s*\}\})',
    re.DOTALL
)

match = pattern_extract.search(text_old)
if not match:
    print("Could not find the missing CSS block in temp_stock_chart.py!")
    sys.exit(1)

missing_css = match.group(1)

with open('openfinch/stock_chart.py', 'r', encoding='utf-8') as f:
    text_new = f.read()

# Insert the missing CSS right after .header-data-btn.open
pattern_insert = re.compile(
    r'(\s+\.header-data-btn\.open\s*\{\{\s*color:\s*#2962ff;\s*border-color:\s*rgba\(41,98,255,0\.4\);\s*background:\s*rgba\(41,98,255,0\.08\);\s*\}\})'
)

if not pattern_insert.search(text_new):
    print("Could not find insertion point!")
    sys.exit(1)

text_new = pattern_insert.sub(
    r'\1\n' + missing_css.replace('\\', '\\\\'),
    text_new
)

with open('openfinch/stock_chart.py', 'w', encoding='utf-8') as f:
    f.write(text_new)

print("Restored missing CSS!")
