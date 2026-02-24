import sys
import re

with open('openfinch/stock_chart.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Pattern to replace from #header to .header-data-btn.open
pattern = re.compile(
    r'\s+#header\s*\{\{.*?\.header-data-btn\.open\s*\{\{.*?\}\}',
    re.DOTALL
)

new_header_css = """
  #header {{
    display: flex; align-items: center; gap: 14px;
    padding: 12px 20px;
    background: #0b0b10;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    z-index: 100; position: relative;
  }}

  #ticker-input {{
    background: transparent; border: 1px solid transparent; border-radius: 6px;
    color: #e0e0e0; font-size: 20px; font-weight: 800; width: 110px;
    padding: 4px 8px; font-family: inherit; outline: none;
    letter-spacing: 0.5px;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }}
  #ticker-input:hover {{ background: rgba(255,255,255,0.04); }}
  #ticker-input:focus {{ border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.06); box-shadow: 0 0 0 3px rgba(41,98,255,0.15); }}
  #ticker-wrap {{ position: relative; }}
  
  /* Modern Glass Dropdowns */
  #ticker-dropdown, #tz-picker {{
    display: none; position: absolute; top: calc(100% + 8px); left: 0;
    background: rgba(17, 17, 24, 0.85);
    backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px;
    box-shadow: 0 16px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05);
    z-index: 200; overflow: hidden; padding: 6px 0;
    opacity: 0; transform: translateY(-5px); transform-origin: top;
    transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1), transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }}
  #ticker-dropdown.open {{ display: block; opacity: 1; transform: translateY(0); }}
  #ticker-dropdown {{ width: 340px; }}
  
  .ticker-suggestion {{
    display: flex; align-items: center; padding: 8px 16px; cursor: pointer;
    font-size: 13px; color: #a0a0a8; transition: background 0.15s, color 0.15s; gap: 12px;
  }}
  .ticker-suggestion:hover, .ticker-suggestion.active {{ background: rgba(255,255,255,0.06); color: #e0e0e0; }}
  .ticker-suggestion .ts-symbol {{ font-weight: 700; color: #e0e0e0; min-width: 70px; letter-spacing: 0.5px; }}
  .ticker-suggestion .ts-name {{ flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
  .ticker-suggestion .ts-exchange {{ font-size: 11px; color: #787b86; flex-shrink: 0; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; }}

  #header .ohlc {{ display: flex; gap: 16px; font-size: 13px; font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace; opacity: 0.8; margin-right: auto; }}
  #header .ohlc span {{ color: #787b86; }}
  #header .ohlc .val {{ color: #e0e0e0; font-weight: 600; }}
  #header .ohlc .up {{ color: #26a69a; }}
  #header .ohlc .down {{ color: #ef5350; }}

  /* Modernized Header Buttons & Selects */
  #interval-select, #btn-indicators-toggle, .header-data-btn, #chart-type, #custom-unit, #clock {{
    background: rgba(255,255,255,0.03); color: #a0a0a8; 
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px; padding: 6px 12px; font-size: 13px; font-weight: 500;
    font-family: inherit; cursor: pointer; outline: none;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }}
  #interval-select:hover, #btn-indicators-toggle:hover, .header-data-btn:hover, #chart-type:hover, #custom-unit:hover, #clock:hover {{
    background: rgba(255,255,255,0.08); color: #e0e0e0; border-color: rgba(255,255,255,0.15); transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }}
  #btn-indicators-toggle:active, .header-data-btn:active, #clock:active {{ transform: translateY(1px); }}
  
  #interval-select option, #chart-type option, #custom-unit option {{ background: #1a1a24; color: #e0e0e0; }}

  .custom-interval {{ display: none; align-items: center; gap: 6px; margin-left: 4px; }}
  .custom-interval.visible {{ display: flex; }}
  #custom-value {{
    background: rgba(0,0,0,0.2); color: #e0e0e0; border: 1px solid rgba(255,255,255,0.06);
    border-radius: 8px; padding: 6px 10px; font-size: 13px; font-weight: 600;
    font-family: inherit; width: 56px; text-align: center; outline: none; transition: all 0.2s;
  }}
  #custom-value:focus {{ border-color: rgba(41,98,255,0.5); box-shadow: 0 0 0 3px rgba(41,98,255,0.15); }}
  
  #custom-apply {{
    background: #2962ff; color: #fff; border: none;
    border-radius: 8px; padding: 6px 14px; font-size: 13px;
    font-weight: 600; cursor: pointer; font-family: inherit;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }}
  #custom-apply:hover {{ background: #3d70ff; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(41,98,255,0.3); }}
  #custom-apply:active {{ transform: translateY(1px); }}

  #btn-indicators-toggle {{ padding: 6px 14px; }}
  #btn-indicators-toggle.open {{ color: #2962ff; border-color: rgba(41,98,255,0.4); background: rgba(41,98,255,0.08); }}

  /* Clock & Timezone Picker Modernization */
  #clock-wrapper {{ position: relative; display: flex; align-items: center; }}
  #clock {{ display: flex; align-items: center; gap: 10px; padding: 5px 14px; }}
  #clock-time {{ font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace; font-size: 14px; font-weight: 600; color: #e0e0e0; letter-spacing: 0.5px; }}
  #clock-tz {{ font-size: 11px; color: #787b86; font-weight: 600; padding: 2px 6px; background: rgba(0,0,0,0.3); border-radius: 4px; border: 1px solid rgba(255,255,255,0.05); }}
  #clock-arrow {{ font-size: 9px; color: #787b86; transition: transform 0.2s; }}
  #clock-wrapper.open #clock-arrow {{ transform: rotate(180deg); }}
  #clock-wrapper.open #clock {{ border-color: rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); }}

  #tz-picker {{ width: 320px; right: 0; left: auto; opacity: 0; transform: translateY(-5px); }}
  #clock-wrapper.open #tz-picker {{ display: block; opacity: 1; transform: translateY(0); }}
  #tz-search-wrap {{ padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); position: relative; }}
  #tz-search {{
    width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
    color: #e0e0e0; padding: 8px 12px 8px 34px; border-radius: 8px; font-size: 13px; font-family: inherit; outline: none; transition: all 0.2s;
  }}
  #tz-search:focus {{ border-color: rgba(41,98,255,0.5); background: rgba(0,0,0,0.5); }}
  #tz-search-icon {{ position: absolute; left: 22px; top: 22px; color: #787b86; font-size: 14px; pointer-events: none; }}
  
  #tz-list {{ max-height: 340px; overflow-y: auto; margin: 0; padding: 6px 0; list-style: none; }}
  #tz-list .tz-group-label {{ padding: 10px 16px 4px; font-size: 11px; font-weight: 700; color: #5a5a66; text-transform: uppercase; letter-spacing: 1.5px; }}
  #tz-list li.tz-item {{ padding: 8px 16px; cursor: pointer; font-size: 13px; color: #a0a0a8; display: flex; align-items: center; gap: 10px; transition: background 0.15s, color 0.15s; }}
  #tz-list li.tz-item:hover {{ background: rgba(255,255,255,0.05); color: #e0e0e0; }}
  #tz-list li.tz-item.active {{ color: #2962ff; background: rgba(41,98,255,0.1); font-weight: 500; border-left: 2px solid #2962ff; padding-left: 14px; }}
  .tz-city {{ flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
  .tz-offset {{ font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace; font-size: 11px; color: #787b86; flex-shrink: 0; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; }}
  .tz-time {{ font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace; font-size: 12px; color: #787b86; flex-shrink: 0; width: 60px; text-align: right; }}
  
  #tz-list::-webkit-scrollbar {{ width: 6px; }}
  #tz-list::-webkit-scrollbar-track {{ background: transparent; }}
  #tz-list::-webkit-scrollbar-thumb {{ background: rgba(255,255,255,0.1); border-radius: 3px; }}
  #tz-list::-webkit-scrollbar-thumb:hover {{ background: rgba(255,255,255,0.2); }}

  /* Header data buttons */
  .header-data-btn {{ white-space: nowrap; }}
  .header-data-btn.open {{ color: #2962ff; border-color: rgba(41,98,255,0.4); background: rgba(41,98,255,0.08); }}"""

if not pattern.search(text):
    print("Could not find the target CSS block!")
    import sys
    sys.exit(1)

text = pattern.sub(new_header_css, text)

with open('openfinch/stock_chart.py', 'w', encoding='utf-8') as f:
    f.write(text)

print("Modernized Header CSS Replaced Successfully!")
