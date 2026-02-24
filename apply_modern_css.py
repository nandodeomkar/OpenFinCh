import sys
import re

with open('openfinch/stock_chart.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Create the regex to match the old CSS block exactly
# It starts at /* ===== DRAWING TOOLBAR ===== */ and ends at .tool-group:hover .expand-arrow {{ ... }}

pattern = re.compile(
    r'/\*\s*=====\s*DRAWING TOOLBAR\s*=====\s*\*/.*?\.tool-group:hover\s*\.expand-arrow\s*\{\{\s*border-color:\s*transparent\s*transparent\s*#c8c8d0\s*transparent;\s*\}\}',
    re.DOTALL
)

new_section = """/* ===== DRAWING TOOLBAR ===== */
  #drawing-toolbar {{
    width: 52px; background: #0b0b10; border-right: 1px solid rgba(255,255,255,0.05);
    display: flex; flex-direction: column; align-items: center;
    padding: 12px 0; gap: 10px; flex-shrink: 0;
    box-shadow: 2px 0 8px rgba(0,0,0,0.2);
  }}
  .dt-btn {{
    width: 36px; height: 36px; border: none; background: transparent;
    border-radius: 8px; cursor: pointer; display: flex;
    align-items: center; justify-content: center; padding: 0;
    color: #787b86; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    position: relative;
  }}
  .dt-btn:hover {{ background: rgba(255,255,255,0.06); color: #c8c8d0; transform: scale(1.05); }}
  .dt-btn:active {{ transform: scale(0.95); }}
  .dt-btn.active {{ background: rgba(41,98,255,0.15); color: #2962ff; }}
  .dt-btn svg {{ pointer-events: none; }}
  .dt-separator {{
    width: 24px; height: 1px; background: rgba(255,255,255,0.05); margin: 4px 0;
  }}

  /* Flyout Menu for Tools */
  .tool-group {{
    position: relative; width: 100%; display: flex;
    justify-content: center;
  }}
  .tool-group-btn {{
    width: 36px; height: 36px; border: none; background: transparent;
    border-radius: 8px; cursor: pointer; display: flex;
    align-items: center; justify-content: center; padding: 0;
    color: #787b86; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }}
  .tool-group-btn:hover {{ background: rgba(255,255,255,0.06); color: #c8c8d0; transform: scale(1.05); }}
  .tool-group-btn:active {{ transform: scale(0.95); }}
  .tool-group-btn svg {{ pointer-events: none; }}
  
  .tool-flyout {{
    display: none; position: absolute; left: 100%; top: -8px;
    margin-left: 14px;
    background: rgba(17, 17, 24, 0.85); 
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 8px; flex-direction: column; gap: 4px;
    box-shadow: 0 12px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05);
    z-index: 250;
    width: max-content; /* THIS FIXES THE WRAPPING */
    opacity: 0;
    transform: translateX(-5px) scale(0.95);
    transform-origin: left center;
    transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }}
  .tool-group:hover .tool-flyout {{ display: flex; opacity: 1; transform: translateX(0) scale(1); }}
  .tool-flyout::before {{
    content: ''; position: absolute;
    top: -20px; bottom: -20px; left: -20px; width: 20px;
    background: transparent;
  }}
  .tool-flyout .dt-btn {{ 
    width: 100%; height: 36px;
    justify-content: flex-start;
    padding: 0 16px 0 12px;
    gap: 12px;
    border-radius: 6px;
  }}
  .tool-flyout .dt-btn:hover {{
    transform: scale(1); /* disable scale inside menu to keep it neat */
    background: rgba(255,255,255,0.08);
  }}
  .dt-label {{
    font-size: 13px;
    font-weight: 500;
    white-space: nowrap;
    color: inherit;
    letter-spacing: 0.3px;
  }}
  
  /* Little arrow on the group button to indicate expansion */
  .expand-arrow {{
    position: absolute; right: 4px; bottom: 4px;
    width: 0; height: 0;
    border-style: solid; border-width: 0 0 4px 4px;
    border-color: transparent transparent #787b86 transparent;
    pointer-events: none;
    transition: border-color 0.2s;
  }}
  .tool-group:hover .expand-arrow {{ border-color: transparent transparent #c8c8d0 transparent; }}"""

if not pattern.search(text):
    print("Could not find the target CSS block!")
    sys.exit(1)

text = pattern.sub(new_section, text)

# We also need to fix color picker button size slightly to match:
cp_pattern = re.compile(
    r'#toolbar-color-btn\s*\{\{\s*padding:\s*6px;\s*display:\s*flex;\s*align-items:\s*center;\s*justify-content:\s*center;\s*border-radius:\s*4px;\s*cursor:\s*pointer;\s*transition:\s*background\s*0\.15s;\s*border:\s*none;\s*background:\s*transparent;\s*margin:\s*4px\s*auto;\s*width:\s*32px;\s*height:\s*32px;\s*\}\}'
)
new_cp_css = """#toolbar-color-btn {{
    padding: 6px; display: flex; align-items: center; justify-content: center;
    border-radius: 8px; cursor: pointer; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    border: none; background: transparent; margin: 4px auto; width: 36px; height: 36px;
  }}
  #toolbar-color-btn:hover {{ background: rgba(255,255,255,0.06); transform: scale(1.05); }}"""
text = cp_pattern.sub(new_cp_css, text)


with open('openfinch/stock_chart.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("Modernized CSS Replaced Successfully!")
