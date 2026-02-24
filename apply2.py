import re

with open('openfinch/stock_chart.py', 'r', encoding='utf-8') as f:
    text = f.read()

old_css = "  .tool-group:hover .tool-flyout {{ display: flex; }}\n  .tool-flyout .dt-btn {{ width: 32px; height: 32px; }}"
new_css = """  .tool-group:hover .tool-flyout {{ display: flex; }}
  .tool-flyout::before {{
    content: ''; position: absolute;
    top: 0; bottom: 0; left: -10px; width: 10px;
    background: transparent;
  }}
  .tool-flyout .dt-btn {{ 
    width: auto; height: 32px;
    justify-content: flex-start;
    padding: 0 12px 0 8px;
    gap: 8px;
  }}
  .dt-label {{
    font-size: 13px;
    white-space: nowrap;
    color: inherit;
  }}"""

if old_css in text:
    text = text.replace(old_css, new_css)
    print("CSS Replaced Successfully!")
else:
    print("Could not find old_css!")

with open('openfinch/stock_chart.py', 'w', encoding='utf-8') as f:
    f.write(text)
