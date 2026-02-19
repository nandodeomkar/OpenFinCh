"""Generate chart HTML to a known path for debugging drawing tools."""
import os
import json

import yfinance as yf
from openfinch.stock_chart import build_chart_html

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

out_path = os.path.join(os.path.dirname(__file__), "debug_chart.html")
with open(out_path, "w", encoding="utf-8") as f:
    f.write(html)

print(f"Chart HTML written to: {out_path}")
print(f"Candles: {len(candle_data)}")
