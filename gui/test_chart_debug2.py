"""Generate a debug version of the chart with console logging to diagnose drawing tool issues."""
import sys
import os
import json

# Add project root to sys.path so yfinance can be imported
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

import yfinance as yf
from stock_chart import build_chart_html

symbol = "AAPL"
ticker = yf.Ticker(symbol)
df = ticker.history(start="2025-01-01", end="2025-02-01", interval="1d")

candle_data = []
volume_data = []
for ts, row in df.iterrows():
    t = ts.strftime("%Y-%m-%d")
    o, h, l, c = float(row["Open"]), float(row["High"]), float(row["Low"]), float(row["Close"])
    v = float(row["Volume"])
    candle_data.append({"time": t, "open": o, "high": h, "low": l, "close": c})
    color = "#26a69a80" if c >= o else "#ef535080"
    volume_data.append({"time": t, "value": v, "color": color})

html = build_chart_html(symbol, candle_data, volume_data, is_intraday=False)

# Inject diagnostic logging into the mousedown handler
# Replace the mousedown handler with one that logs everything
debug_injection = """
// ===== DEBUG: Diagnostic overlay =====
const debugDiv = document.createElement('div');
debugDiv.style.cssText = 'position:fixed;top:0;right:0;background:rgba(0,0,0,0.85);color:#0f0;padding:10px;font:12px monospace;z-index:99999;max-width:400px;pointer-events:none;';
document.body.appendChild(debugDiv);

// Patch mousedown to log diagnostics
const origMouseDown = drawingSvg.onmousedown;
drawingSvg.addEventListener('mousedown', function debugHandler(e) {
    const rect = drawingSvg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pt = fromScreen(x, y);
    
    const chartRect = document.getElementById('chart').getBoundingClientRect();
    
    const info = [
        `activeTool: ${activeTool}`,
        `SVG rect: ${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)}`,
        `Chart rect: ${Math.round(chartRect.left)},${Math.round(chartRect.top)} ${Math.round(chartRect.width)}x${Math.round(chartRect.height)}`,
        `Click clientXY: ${Math.round(e.clientX)},${Math.round(e.clientY)}`,
        `Click localXY: ${x.toFixed(1)},${y.toFixed(1)}`,
        `fromScreen => time: ${JSON.stringify(pt.time)}, price: ${pt.price}`,
        `pt.time === null: ${pt.time === null}`,
        `pt.price === null: ${pt.price === null}`,
        `typeof pt.time: ${typeof pt.time}`,
        `typeof pt.price: ${typeof pt.price}`,
        `SVG has drawing-mode: ${drawingSvg.classList.contains('drawing-mode')}`,
        `pendingPoints: ${pendingPoints.length}`,
    ];
    debugDiv.innerHTML = info.join('<br>');
    console.log('=== DRAWING DEBUG ===');
    info.forEach(line => console.log(line));
}, true);  // Use capture phase so it fires before the main handler

// Also patch tool activation
const origSetActiveTool = setActiveTool;
// Can't easily reassign, so just add logging
document.querySelectorAll('#draw-toolbar [data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
        setTimeout(() => {
            debugDiv.innerHTML = `Tool activated: ${activeTool}<br>drawing-mode: ${drawingSvg.classList.contains('drawing-mode')}`;
            console.log(`Tool activated: ${activeTool}, drawing-mode: ${drawingSvg.classList.contains('drawing-mode')}`);
        }, 10);
    });
});
"""

# Insert the debug code before </script>
html = html.replace('</script>', debug_injection + '\n</script>')

out_path = os.path.join(os.path.dirname(__file__), "debug_chart2.html")
with open(out_path, "w", encoding="utf-8") as f:
    f.write(html)

print(f"Debug chart written to: {out_path}")
print(f"Open this file in browser, select H-Line tool, click on chart, and check the green overlay text")
