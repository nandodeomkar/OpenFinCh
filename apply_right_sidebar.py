import sys
import re

with open('openfinch/stock_chart.py', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Remove the old header buttons from #header HTML
old_buttons = """  <button class="header-data-btn" data-tab="news">&#128240; News</button>
  <button class="header-data-btn" data-tab="insiders">&#128100; Insiders</button>
  <button class="header-data-btn" data-tab="profile">&#127970; Profile</button>
  <button class="header-data-btn" data-tab="analysts">&#128200; Analysts</button>
  <button class="header-data-btn" data-tab="financials">&#128176; Financials</button>"""

if old_buttons in text:
    text = text.replace(old_buttons, "")
else:
    print("Could not find old header buttons in HTML!")
    # Might have different spacing due to previous formatting, let's use regex
    text = re.sub(r'\s*<button class="header-data-btn".*?</button>', '', text)

# 2. Add the new right-toolbar after #data-panel
right_toolbar_html = """  <div id="data-panel">
    <div id="data-panel-header">
      <div class="tab-bar">
        <button class="data-tab" data-tab="news">News</button>
        <button class="data-tab" data-tab="insiders">Insiders</button>
        <button class="data-tab" data-tab="profile">Profile</button>
        <button class="data-tab" data-tab="analysts">Analysts</button>
        <button class="data-tab" data-tab="financials">Financials</button>
      </div>
      <button id="data-panel-close">&times;</button>
    </div>
    <div id="data-panel-body">
      <div class="tab-pane" id="tab-news"></div>
      <div class="tab-pane" id="tab-insiders"></div>
      <div class="tab-pane" id="tab-profile"></div>
      <div class="tab-pane" id="tab-analysts"></div>
      <div class="tab-pane" id="tab-financials"></div>
    </div>
  </div>
  
  <div id="right-toolbar">
    <button class="header-data-btn rt-btn" data-tab="news">
      &#128240;
      <div class="rt-flyout">News</div>
    </button>
    <button class="header-data-btn rt-btn" data-tab="insiders">
      &#128100;
      <div class="rt-flyout">Insiders</div>
    </button>
    <button class="header-data-btn rt-btn" data-tab="profile">
      &#127970;
      <div class="rt-flyout">Profile</div>
    </button>
    <button class="header-data-btn rt-btn" data-tab="analysts">
      &#128200;
      <div class="rt-flyout">Analysts</div>
    </button>
    <button class="header-data-btn rt-btn" data-tab="financials">
      &#128176;
      <div class="rt-flyout">Financials</div>
    </button>
  </div>"""

# Ensure we don't accidentally replace too much, match exactly the data-panel block
pattern_data_panel = re.compile(
    r'\s*<div id="data-panel">.*?</button>\s*</div>\s*<div id="data-panel-body">.*?</div>\s*</div>',
    re.DOTALL
)

if not pattern_data_panel.search(text):
    print("Could not find data-panel to replace!")
else:
    text = pattern_data_panel.sub('\n' + right_toolbar_html, text)

# 3. Add CSS for #right-toolbar
css_to_add = """
  /* ===== RIGHT TOOLBAR ===== */
  #right-toolbar {{
    width: 52px; background: #0b0b10; border-left: 1px solid rgba(255,255,255,0.05);
    display: flex; flex-direction: column; align-items: center;
    padding: 12px 0; gap: 10px; flex-shrink: 0;
    box-shadow: -2px 0 8px rgba(0,0,0,0.2);
    z-index: 100;
  }}
  .rt-btn {{
    width: 36px; height: 36px; border: none; background: transparent;
    border-radius: 8px; cursor: pointer; display: flex;
    align-items: center; justify-content: center; padding: 0;
    color: #787b86; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    position: relative; font-size: 16px;
  }}
  .rt-btn:hover {{ background: rgba(255,255,255,0.06); color: #c8c8d0; transform: scale(1.05); }}
  .rt-btn:active {{ transform: scale(0.95); }}
  .rt-btn.open {{ background: rgba(41,98,255,0.15); color: #e0e0e0; border: 1px solid rgba(41,98,255,0.4); box-shadow: 0 4px 12px rgba(41,98,255,0.15); }}
  
  .rt-flyout {{
    display: none; position: absolute; right: 100%; top: 50%;
    margin-right: 14px;
    background: rgba(17, 17, 24, 0.85); 
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px;
    padding: 6px 12px; font-size: 13px; font-weight: 500; font-family: inherit;
    color: #e0e0e0; white-space: nowrap; pointer-events: none;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    opacity: 0; transform: translateY(-50%) translateX(5px);
    transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }}
  .rt-flyout::before {{
    content: ''; position: absolute; top: 50%; right: -10px; transform: translateY(-50%);
    border-width: 5px; border-style: solid;
    border-color: transparent transparent transparent rgba(17, 17, 24, 0.85);
  }}
  .rt-btn:hover .rt-flyout {{ display: block; opacity: 1; transform: translateY(-50%) translateX(0); }}

  /* End Right Toolbar */
"""

# Insert CSS before #chart-area
pattern_css_insert = re.compile(
    r'(\s+#chart-area\s*\{\{\s*flex:\s*1;\s*min-height:\s*0;\s*display:\s*flex;\s*\}\})'
)
if pattern_css_insert.search(text):
    text = pattern_css_insert.sub(css_to_add.replace('\\', '\\\\') + r'\1', text)
else:
    print("Could not insert CSS!")

# Let's ensure the data logic handles the classes correctly
# We are repurposing `.header-data-btn` for the right sidebar buttons to hook into the existing JS events!
# That means clicking them will still work normally.

with open('openfinch/stock_chart.py', 'w', encoding='utf-8') as f:
    f.write(text)
print("Applied right sidebar changes successfully!")
