import re

with open('openfinch/stock_chart.py', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Replace CSS
new_css = """  .tool-group:hover .tool-flyout { display: flex; }
  .tool-flyout::before {
    content: ''; position: absolute;
    top: 0; bottom: 0; left: -10px; width: 10px;
    background: transparent;
  }
  .tool-flyout .dt-btn { 
    width: auto; height: 32px;
    justify-content: flex-start;
    padding: 0 12px 0 8px;
    gap: 8px;
  }
  .dt-label {
    font-size: 13px;
    white-space: nowrap;
    color: inherit;
  }"""
text = re.sub(
    r'\s*\.tool-group:hover \.tool-flyout \{ display: flex; \}\s*\.tool-flyout \.dt-btn \{ width: 32px; height: 32px; \}',
    '\n' + new_css,
    text,
    count=1
)

# 2. Add labels to dt-btn for cursor tools
cursor_tools = [
     ('data-cursor="cross"', 'title="Cross"', 'Cross'),
     ('data-cursor="dot"', 'title="Dot"', 'Dot'),
     ('data-cursor="arrow"', 'title="Arrow"', 'Arrow')
]
for data, title, label in cursor_tools:
    pattern = rf'(<button class="[^"]*dt-btn[^"]*"[^>]*{data}[^>]*>[\s\S]*?</svg>)'
    replacement = rf'\1\n          <span class="dt-label">{label}</span>'
    text = re.sub(pattern, replacement, text, count=1)

# 3. Add labels to dt-btn for line tools
line_tools = [
    ('data-tool="trendline"', 'Trend Line'),
    ('data-tool="ray"', 'Ray'),
    ('data-tool="infoline"', 'Info Line'),
    ('data-tool="extendedline"', 'Extended Line'),
    ('data-tool="trendangle"', 'Trend Angle'),
    ('data-tool="hline"', 'Horizontal Line'),
    ('data-tool="hray"', 'Horizontal Ray'),
    ('data-tool="vline"', 'Vertical Line'),
    ('data-tool="crossline"', 'Cross Line')
]
for data, label in line_tools:
    pattern = rf'(<button class="[^"]*dt-btn[^"]*"[^>]*{data}[^>]*>[\s\S]*?</svg>)'
    replacement = rf'\1\n          <span class="dt-label">{label}</span>'
    text = re.sub(pattern, replacement, text, count=1)

with open('openfinch/stock_chart.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("Applied!")
