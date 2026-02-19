import sys
import os
import json
import tempfile
import webbrowser
import tkinter as tk
from tkinter import ttk, messagebox
from datetime import date

import pandas as pd
import yfinance as yf


def get_user_input():
    """Show a GUI dialog to collect ticker, date range, and interval."""
    result = {}

    def on_submit():
        symbol = symbol_var.get().strip().upper()
        start = start_var.get().strip()
        end = end_var.get().strip()
        interval = interval_var.get().strip()

        if not symbol:
            messagebox.showerror("Error", "Ticker symbol is required.")
            return
        if not start:
            messagebox.showerror("Error", "Start date is required.")
            return
        if not end:
            messagebox.showerror("Error", "End date is required.")
            return

        result["symbol"] = symbol
        result["start"] = start
        result["end"] = end
        result["interval"] = interval
        root.destroy()

    root = tk.Tk()
    root.title("Stock Chart")
    root.resizable(False, False)
    root.configure(bg="#0a0a0f")

    style = ttk.Style(root)
    style.theme_use("clam")
    style.configure("TLabel", background="#0a0a0f", foreground="#e0e0e0", font=("Segoe UI", 10))
    style.configure("TEntry", fieldbackground="#1a1a24", foreground="#e0e0e0", font=("Segoe UI", 10))
    style.configure("TButton", background="#f0b90b", foreground="#0a0a0f", font=("Segoe UI", 10, "bold"))
    style.map("TButton", background=[("active", "#d4a20a")])
    style.configure("Header.TLabel", font=("Segoe UI", 14, "bold"), foreground="#f0b90b")
    style.configure("Info.TLabel", foreground="#787b86", font=("Segoe UI", 8))
    style.configure("TCombobox", fieldbackground="#1a1a24", foreground="#e0e0e0", font=("Segoe UI", 10))
    style.map("TCombobox", fieldbackground=[("readonly", "#1a1a24")])

    frame = ttk.Frame(root, padding=20)
    frame.configure(style="TFrame")
    style.configure("TFrame", background="#0a0a0f")
    frame.grid()

    ttk.Label(frame, text="Stock Chart", style="Header.TLabel").grid(
        row=0, column=0, columnspan=2, pady=(0, 15)
    )

    symbol_var = tk.StringVar(value="AAPL")
    start_var = tk.StringVar(value="2025-01-01")
    end_var = tk.StringVar(value=str(date.today()))
    interval_var = tk.StringVar(value="1h")

    text_labels = ["Ticker Symbol", "Start Date (YYYY-MM-DD)", "End Date (YYYY-MM-DD)"]
    text_vars = [symbol_var, start_var, end_var]

    for i, (label, var) in enumerate(zip(text_labels, text_vars)):
        ttk.Label(frame, text=label).grid(row=i + 1, column=0, sticky="w", pady=4, padx=(0, 10))
        entry = ttk.Entry(frame, textvariable=var, width=25)
        entry.grid(row=i + 1, column=1, pady=4)
        if i == 0:
            entry.focus_set()

    row_interval = len(text_labels) + 1
    ttk.Label(frame, text="Interval").grid(row=row_interval, column=0, sticky="w", pady=4, padx=(0, 10))
    interval_combo = ttk.Combobox(
        frame, textvariable=interval_var, values=["1h", "4h", "1d"],
        state="readonly", width=22
    )
    interval_combo.grid(row=row_interval, column=1, pady=4)

    ttk.Label(
        frame,
        text="1h/4h: max ~2 yrs lookback  |  1d: unlimited",
        style="Info.TLabel",
    ).grid(row=row_interval + 1, column=0, columnspan=2, pady=(0, 4))

    submit_btn = ttk.Button(frame, text="Show Chart", command=on_submit)
    submit_btn.grid(row=row_interval + 2, column=0, columnspan=2, pady=(15, 0))

    root.bind("<Return>", lambda e: on_submit())

    # Center on screen
    root.update_idletasks()
    w, h = root.winfo_width(), root.winfo_height()
    x = (root.winfo_screenwidth() - w) // 2
    y = (root.winfo_screenheight() - h) // 2
    root.geometry(f"+{x}+{y}")

    root.mainloop()
    return result


def fetch_data(symbol, start, end, interval):
    """Download OHLCV data via yfinance; resample for 4h."""
    ticker = yf.Ticker(symbol)

    if interval == "4h":
        df = ticker.history(start=start, end=end, interval="1h")
        if df.empty:
            return df
        df = df.resample("4h").agg({
            "Open": "first",
            "High": "max",
            "Low": "min",
            "Close": "last",
            "Volume": "sum",
        }).dropna()
    else:
        df = ticker.history(start=start, end=end, interval=interval)

    return df


def build_chart_html(symbol, candle_data, volume_data, is_intraday):
    """Generate an HTML page with a Lightweight Chart, bar-replay controls, and amber/dark theme."""
    candles_json = json.dumps(candle_data)
    volume_json = json.dumps(volume_data)
    time_visible = "true" if is_intraday else "false"

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{symbol} — Stock Chart</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  html, body {{ height: 100%; overflow: hidden; }}
  body {{ background: #0a0a0f; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; flex-direction: column; }}
  a[href*="tradingview"] {{ display: none !important; }}
  #header {{
    display: flex; align-items: center; gap: 12px;
    padding: 10px 16px; background: #111118; border-bottom: 1px solid #1e1e28;
  }}
  #header .symbol {{ color: #e0e0e0; font-size: 18px; font-weight: 700; }}
  #header .ohlc {{ display: flex; gap: 14px; font-size: 13px; }}
  #header .ohlc span {{ color: #787b86; }}
  #header .ohlc .val {{ color: #e0e0e0; font-weight: 500; }}
  #header .ohlc .up {{ color: #26a69a; }}
  #header .ohlc .down {{ color: #ef5350; }}

  /* Replay controls */
  #controls {{
    display: flex; align-items: center; gap: 10px;
    padding: 8px 16px; background: #111118; border-bottom: 1px solid #1e1e28;
    flex-wrap: wrap;
  }}
  #controls button {{
    background: #1a1a24; color: #e0e0e0; border: 1px solid #2a2a36;
    border-radius: 4px; padding: 5px 12px; cursor: pointer;
    font-size: 13px; font-family: inherit; transition: background 0.15s;
  }}
  #controls button:hover {{ background: #28283a; }}
  #controls button.active {{ background: #f0b90b; color: #0a0a0f; border-color: #f0b90b; }}
  #controls .sep {{ width: 1px; height: 22px; background: #1e1e28; }}
  #controls .label {{ color: #787b86; font-size: 12px; }}
  #controls .counter {{ color: #e0e0e0; font-size: 13px; font-variant-numeric: tabular-nums; min-width: 80px; }}
  #speed-slider {{
    -webkit-appearance: none; appearance: none; width: 100px; height: 4px;
    background: #2a2a36; border-radius: 2px; outline: none;
  }}
  #speed-slider::-webkit-slider-thumb {{
    -webkit-appearance: none; appearance: none; width: 14px; height: 14px;
    background: #f0b90b; border-radius: 50%; cursor: pointer;
  }}
  #speed-slider::-moz-range-thumb {{
    width: 14px; height: 14px; background: #f0b90b; border-radius: 50%;
    cursor: pointer; border: none;
  }}

  #chart-type {{
    background: #1a1a24; color: #e0e0e0; border: 1px solid #2a2a36;
    border-radius: 4px; padding: 4px 8px; font-size: 13px;
    font-family: inherit; cursor: pointer; outline: none;
  }}
  #chart-type option {{ background: #1a1a24; color: #e0e0e0; }}

  /* Replay toggle */
  #btn-replay-toggle {{
    margin-left: auto; background: #1a1a24; color: #787b86;
    border: 1px solid #2a2a36; border-radius: 4px; padding: 4px 10px;
    cursor: pointer; font-size: 12px; font-family: inherit;
    transition: color 0.15s, background 0.15s; white-space: nowrap;
  }}
  #btn-replay-toggle:hover {{ color: #e0e0e0; background: #28283a; }}
  #btn-replay-toggle.open {{ color: #f0b90b; border-color: rgba(240,185,11,0.4); }}

  /* Drawing toolbar + chart layout */
  #chart-area {{
    flex: 1; min-height: 0; display: flex;
  }}
  #draw-toolbar {{
    width: 72px; background: #111118; border-right: 1px solid #1e1e28;
    display: flex; flex-direction: column; align-items: center;
    padding: 4px 0; gap: 1px; overflow-y: auto; flex-shrink: 0;
    user-select: none; transition: width 0.2s, padding 0.2s;
  }}
  #draw-toolbar.collapsed {{ width: 0; padding: 0; overflow: hidden; border-right: none; }}
  #sidebar-toggle {{
    position: absolute; left: 0; top: 50%; transform: translateY(-50%);
    z-index: 20; width: 16px; height: 48px; background: #1a1a24;
    border: 1px solid #2a2a36; border-left: none; border-radius: 0 6px 6px 0;
    color: #787b86; cursor: pointer; display: flex; align-items: center;
    justify-content: center; font-size: 10px; transition: background 0.15s;
  }}
  #sidebar-toggle:hover {{ background: #28283a; color: #e0e0e0; }}
  .tool-group-header {{
    font-size: 8px; color: #555; text-transform: uppercase;
    letter-spacing: 0.5px; padding: 6px 0 2px; width: 100%;
    text-align: center; cursor: pointer; transition: color 0.15s;
  }}
  .tool-group-header:hover {{ color: #888; }}
  .tool-group-header .arrow {{ font-size: 6px; margin-left: 2px; }}
  .tool-group-items {{ display: flex; flex-direction: column; align-items: center; gap: 1px; width: 100%; }}
  .tool-group-items.collapsed-group {{ display: none; }}
  #draw-toolbar button {{
    width: 66px; height: 44px; background: none; border: none;
    border-radius: 4px; cursor: pointer; color: #555;
    font-size: 13px; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 3px;
    transition: background 0.1s, color 0.1s; position: relative;
  }}
  #draw-toolbar button:hover {{ background: #1a1a24; color: #ccc; }}
  #draw-toolbar button.tool-active {{
    background: #1e1e2c; color: #f0b90b;
    outline: 1px solid rgba(240,185,11,0.3); outline-offset: -2px;
  }}
  #draw-toolbar .tool-label {{
    font-size: 8px; color: inherit; line-height: 1;
    white-space: nowrap; pointer-events: none;
  }}
  #charts-container {{
    flex: 1; display: flex; flex-direction: column; min-width: 0;
  }}
  .chart-pane {{
    position: relative; min-height: 0;
  }}
  .chart-pane .pane-chart {{
    position: absolute; inset: 0; z-index: 0;
  }}
  .chart-pane .pane-svg {{
    position: absolute; top: 0; left: 0;
    pointer-events: none; overflow: visible; z-index: 5;
  }}
  .chart-pane .pane-svg.drawing-mode {{ pointer-events: all; cursor: crosshair; z-index: 10; }}
  .pane-divider {{
    height: 4px; background: #1e1e28; cursor: row-resize;
    flex-shrink: 0; position: relative; z-index: 15;
  }}
  .pane-divider:hover, .pane-divider.dragging {{ background: #2962ff; }}
  .pane-label {{
    position: absolute; top: 4px; left: 8px; z-index: 6;
    color: #787b86; font-size: 10px; pointer-events: none;
    text-transform: uppercase; letter-spacing: 0.5px;
  }}

  /* Indicators panel */
  #btn-indicators-toggle {{
    background: #1a1a24; color: #787b86;
    border: 1px solid #2a2a36; border-radius: 4px; padding: 4px 10px;
    cursor: pointer; font-size: 12px; font-family: inherit;
    transition: color 0.15s, background 0.15s; white-space: nowrap;
  }}
  #btn-indicators-toggle:hover {{ color: #e0e0e0; background: #28283a; }}
  #btn-indicators-toggle.open {{ color: #2962ff; border-color: rgba(41,98,255,0.4); }}
  #indicators-panel {{
    display: none; padding: 8px 16px; background: #111118;
    border-bottom: 1px solid #1e1e28;
    gap: 18px; align-items: center; flex-wrap: wrap;
  }}
  #indicators-panel label {{
    color: #c8c8d0; font-size: 13px; cursor: pointer;
    display: flex; align-items: center; gap: 6px;
    transition: color 0.15s;
  }}
  #indicators-panel label:hover {{ color: #e0e0e0; }}
  #indicators-panel input[type="checkbox"] {{
    accent-color: #2962ff; width: 14px; height: 14px; cursor: pointer;
  }}
  .ind-legend {{
    font-size: 13px; color: #787b86;
  }}
  .ind-legend .ind-val {{
    color: #5b9cf6; font-weight: 500;
  }}
</style>
</head>
<body>
<div id="header">
  <div class="symbol">{symbol}</div>
  <div class="ohlc" id="legend">
    <span>O <span class="val" id="lo">—</span></span>
    <span>H <span class="val" id="lh">—</span></span>
    <span>L <span class="val" id="ll">—</span></span>
    <span>C <span class="val" id="lc">—</span></span>
    <span id="vol-legend">Vol <span class="val" id="lv">—</span></span>
  </div>
  <button id="btn-indicators-toggle">&#128202; Indicators &#9660;</button>
  <button id="btn-replay-toggle">&#9654; Replay &#9660;</button>
</div>
<div id="indicators-panel">
  <label><input type="checkbox" id="ind-volume" checked> Volume</label>
</div>
<div id="controls" style="display:none">
  <button id="btn-back" title="Step Back (Left Arrow)">&#9198; Back</button>
  <button id="btn-play" title="Play / Pause (Space)">&#9654; Play</button>
  <button id="btn-fwd" title="Step Forward (Right Arrow)">&#9197; Forward</button>
  <div class="sep"></div>
  <span class="label">Speed</span>
  <input type="range" id="speed-slider" min="1" max="100" value="50">
  <div class="sep"></div>
  <span class="counter" id="counter">— / —</span>
  <div class="sep"></div>
  <button id="btn-reset" title="Reset to first candle">&#8617; Reset</button>
  <button id="btn-all" title="Show all candles">Show All</button>
  <div class="sep"></div>
  <span class="label">Type</span>
  <select id="chart-type">
    <option value="candles" selected>Candles</option>
    <option value="line">Line</option>
    <option value="area">Area</option>
  </select>
</div>

<div id="chart-area">
  <div id="draw-toolbar">
    <button data-tool="cursor" class="tool-active">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M2 2l10 5-5 1-2 5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
      </svg>
      <span class="tool-label">Cursor</span>
    </button>

    <div class="tool-group-header" id="lines-header">lines <span class="arrow">&#9660;</span></div>
    <div class="tool-group-items" id="lines-group">
      <button data-tool="trendline">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <line x1="2" y1="12" x2="12" y2="2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="2" cy="12" r="1.5" fill="currentColor"/>
          <circle cx="12" cy="2" r="1.5" fill="currentColor"/>
        </svg>
        <span class="tool-label">Trend</span>
      </button>

      <button data-tool="ray">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <line x1="2" y1="12" x2="10" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="2" cy="12" r="1.5" fill="currentColor"/>
          <polygon points="12,2 10,6 8,4" fill="currentColor"/>
        </svg>
        <span class="tool-label">Ray</span>
      </button>

      <button data-tool="extended">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <line x1="3" y1="11" x2="11" y2="3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <polygon points="13,1 11,5 9,3" fill="currentColor"/>
          <polygon points="1,13 5,11 3,9" fill="currentColor"/>
        </svg>
        <span class="tool-label">Extended</span>
      </button>

      <button data-tool="hline">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="tool-label">H-Line</span>
      </button>

      <button data-tool="hray">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <line x1="1" y1="7" x2="11" y2="7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <polygon points="13,7 10,5.5 10,8.5" fill="currentColor"/>
        </svg>
        <span class="tool-label">H-Ray</span>
      </button>

      <button data-tool="vline">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="tool-label">V-Line</span>
      </button>

      <button data-tool="cross">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <line x1="1" y1="7" x2="13" y2="7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          <line x1="7" y1="1" x2="7" y2="13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        <span class="tool-label">Cross</span>
      </button>

      <button data-tool="info">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <line x1="2" y1="11" x2="12" y2="3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="2" cy="11" r="1.5" fill="currentColor"/>
          <circle cx="12" cy="3" r="1.5" fill="currentColor"/>
          <rect x="5" y="5.5" width="4" height="3" rx="0.5" stroke="currentColor" stroke-width="1" fill="none"/>
        </svg>
        <span class="tool-label">Info</span>
      </button>

      <button data-tool="angle">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <line x1="2" y1="12" x2="12" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="2" y1="12" x2="10" y2="3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M6,12 A4,4 0 0,0 4.8,9" stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round"/>
        </svg>
        <span class="tool-label">Angle</span>
      </button>
    </div>

    <div class="tool-group-header" id="channels-header">channels <span class="arrow">&#9660;</span></div>
    <div class="tool-group-items" id="channels-group">
      <button data-tool="parallel_channel">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <line x1="1" y1="10" x2="13" y2="4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          <line x1="1" y1="13" x2="13" y2="7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          <line x1="1" y1="10" x2="1" y2="13" stroke="currentColor" stroke-width="0.8" stroke-dasharray="2,2"/>
          <line x1="13" y1="4" x2="13" y2="7" stroke="currentColor" stroke-width="0.8" stroke-dasharray="2,2"/>
        </svg>
        <span class="tool-label">Par Chan</span>
      </button>

      <button data-tool="regression_trend">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <line x1="1" y1="10" x2="13" y2="4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          <line x1="1" y1="7" x2="13" y2="1" stroke="currentColor" stroke-width="0.8" stroke-dasharray="2,2"/>
          <line x1="1" y1="13" x2="13" y2="7" stroke="currentColor" stroke-width="0.8" stroke-dasharray="2,2"/>
        </svg>
        <span class="tool-label">Regress</span>
      </button>

      <button data-tool="flat_top_bottom">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <line x1="1" y1="11" x2="13" y2="5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          <line x1="1" y1="4" x2="13" y2="4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        <span class="tool-label">Flat T/B</span>
      </button>

      <button data-tool="disjoint_channel">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <line x1="1" y1="4" x2="13" y2="2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          <line x1="1" y1="12" x2="13" y2="8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        <span class="tool-label">Disjoint</span>
      </button>
    </div>

    <div class="tool-group-header" style="margin-top:4px">————</div>

    <button id="btn-undo">
      <svg width="14" height="14" viewBox="0 0 14 14">
        <path d="M2 7a5 5 0 1 1 1.5 3.5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/>
        <polyline points="2,4 2,7 5,7" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linejoin="round"/>
      </svg>
      <span class="tool-label">Undo</span>
    </button>
    <button id="btn-clear-all">
      <svg width="14" height="14" viewBox="0 0 14 14">
        <line x1="3" y1="3" x2="11" y2="11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        <line x1="11" y1="3" x2="3" y2="11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
      </svg>
      <span class="tool-label">Clear</span>
    </button>
  </div>

  <div id="charts-container">
    <div id="main-pane" class="chart-pane" style="flex:1">
      <button id="sidebar-toggle">&#9664;</button>
      <div id="chart" class="pane-chart"></div>
      <svg id="drawing-svg" class="pane-svg"></svg>
    </div>
    <!-- Indicator sub-panes are inserted here dynamically -->
  </div>
</div>

<script src="https://unpkg.com/lightweight-charts@4/dist/lightweight-charts.standalone.production.js"></script>
<script>
const ALL_CANDLES = {candles_json};
const ALL_VOLUME  = {volume_json};

const container = document.getElementById('chart');
const chart = LightweightCharts.createChart(container, {{
  autoSize: true,
  layout: {{ background: {{ type: 'solid', color: '#0a0a0f' }}, textColor: '#e0e0e0' }},
  grid: {{ vertLines: {{ color: '#1a1a24' }}, horzLines: {{ color: '#1a1a24' }} }},
  crosshair: {{ mode: LightweightCharts.CrosshairMode.Normal }},
  rightPriceScale: {{ borderColor: '#1e1e28' }},
  timeScale: {{ borderColor: '#1e1e28', timeVisible: {time_visible}, secondsVisible: false }},
  watermark: {{ visible: false }},
}});

const candleSeries = chart.addCandlestickSeries({{
  upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
  wickUpColor: '#26a69a', wickDownColor: '#ef5350',
}});

const lineSeries = chart.addLineSeries({{
  color: '#f0b90b', lineWidth: 2, visible: false,
  crosshairMarkerRadius: 4,
}});

const areaSeries = chart.addAreaSeries({{
  lineColor: '#f0b90b', lineWidth: 2,
  topColor: 'rgba(240, 185, 11, 0.35)',
  bottomColor: 'rgba(240, 185, 11, 0.02)',
  visible: false,
  crosshairMarkerRadius: 4,
}});

// Pre-build line/area data (close prices)
const ALL_LINE = ALL_CANDLES.map(c => ({{ time: c.time, value: c.close }}));

// Volume series is now created in a separate sub-pane (see indicator toggle below)
let volumeSeries = null;  // set when volume pane is created

let chartMode = 'candles'; // 'candles', 'line', or 'area'

// ---------- Bar Replay ----------
let currentIndex = ALL_CANDLES.length;
let playTimer = null;

const counterEl = document.getElementById('counter');
const btnPlay   = document.getElementById('btn-play');

function revealUpTo(n) {{
  n = Math.max(1, Math.min(n, ALL_CANDLES.length));
  currentIndex = n;
  candleSeries.setData(ALL_CANDLES.slice(0, n));
  lineSeries.setData(ALL_LINE.slice(0, n));
  areaSeries.setData(ALL_LINE.slice(0, n));
  if (volumeSeries) volumeSeries.setData(ALL_VOLUME.slice(0, n));

  counterEl.textContent = n + ' / ' + ALL_CANDLES.length;
  if (n >= ALL_CANDLES.length && playTimer) {{ stopPlay(); }}
}}

function stepForward() {{ revealUpTo(currentIndex + 1); }}
function stepBack()    {{ revealUpTo(currentIndex - 1); }}

function getSpeed() {{
  const v = parseInt(document.getElementById('speed-slider').value, 10);
  return 1050 - v * 10;   // 1 → 1040ms, 50 → 550ms, 100 → 50ms
}}

function startPlay() {{
  if (currentIndex >= ALL_CANDLES.length) {{ revealUpTo(1); }}
  playTimer = setInterval(() => {{
    if (currentIndex >= ALL_CANDLES.length) {{ stopPlay(); return; }}
    stepForward();
  }}, getSpeed());
  btnPlay.innerHTML = '&#9208; Pause';
  btnPlay.classList.add('active');
}}

function stopPlay() {{
  clearInterval(playTimer);
  playTimer = null;
  btnPlay.innerHTML = '&#9654; Play';
  btnPlay.classList.remove('active');
}}

function togglePlay() {{ playTimer ? stopPlay() : startPlay(); }}

// Replay panel toggle
document.getElementById('btn-replay-toggle').addEventListener('click', () => {{
  const ctrl = document.getElementById('controls');
  const isOpen = ctrl.style.display !== 'none';
  ctrl.style.display = isOpen ? 'none' : 'flex';
  const btn = document.getElementById('btn-replay-toggle');
  btn.classList.toggle('open', !isOpen);
  btn.innerHTML = isOpen ? '&#9654; Replay &#9660;' : '&#9654; Replay &#9650;';
}});

// Re-create interval when speed changes during playback
document.getElementById('speed-slider').addEventListener('input', () => {{
  if (playTimer) {{ stopPlay(); startPlay(); }}
}});

document.getElementById('btn-back').addEventListener('click', () => {{ stopPlay(); stepBack(); }});
document.getElementById('btn-fwd').addEventListener('click',  () => {{ stopPlay(); stepForward(); }});
document.getElementById('btn-play').addEventListener('click', togglePlay);
document.getElementById('btn-reset').addEventListener('click', () => {{ stopPlay(); revealUpTo(1); }});
document.getElementById('btn-all').addEventListener('click',  () => {{ stopPlay(); revealUpTo(ALL_CANDLES.length); chart.timeScale().fitContent(); }});

// ---------- Chart Type Dropdown ----------
const chartTypeSelect = document.getElementById('chart-type');

function setChartMode(mode) {{
  chartMode = mode;
  candleSeries.applyOptions({{ visible: mode === 'candles' }});
  lineSeries.applyOptions({{ visible: mode === 'line' }});
  areaSeries.applyOptions({{ visible: mode === 'area' }});
  chartTypeSelect.value = mode;
}}

chartTypeSelect.addEventListener('change', () => setChartMode(chartTypeSelect.value));

// Keyboard shortcuts (replay)
document.addEventListener('keydown', e => {{
  if (e.code === 'Space')      {{ e.preventDefault(); togglePlay(); }}
  if (e.code === 'ArrowRight') {{ e.preventDefault(); stopPlay(); stepForward(); }}
  if (e.code === 'ArrowLeft')  {{ e.preventDefault(); stopPlay(); stepBack(); }}
}});

// Initial state: show all candles
revealUpTo(ALL_CANDLES.length);
chart.timeScale().fitContent();

// ---------- OHLC Legend ----------
const lo = document.getElementById('lo');
const lh = document.getElementById('lh');
const ll = document.getElementById('ll');
const lc = document.getElementById('lc');
const lv = document.getElementById('lv');

function formatVol(v) {{
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toString();
}}

chart.subscribeCrosshairMove(param => {{
  if (!param || !param.time) {{ return; }}
  const candle = param.seriesData.get(candleSeries);
  const line = param.seriesData.get(lineSeries);
  const vol = param.seriesData.get(volumeSeries);
  if (chartMode === 'candles' && candle) {{
    const cls = candle.close >= candle.open ? 'up' : 'down';
    lo.textContent = candle.open.toFixed(2); lo.className = 'val ' + cls;
    lh.textContent = candle.high.toFixed(2); lh.className = 'val ' + cls;
    ll.textContent = candle.low.toFixed(2);  ll.className = 'val ' + cls;
    lc.textContent = candle.close.toFixed(2); lc.className = 'val ' + cls;
  }} else if (chartMode === 'line' || chartMode === 'area') {{
    const pt = param.seriesData.get(chartMode === 'line' ? lineSeries : areaSeries);
    if (pt) {{
      lo.textContent = '—'; lo.className = 'val';
      lh.textContent = '—'; lh.className = 'val';
      ll.textContent = '—'; ll.className = 'val';
      lc.textContent = pt.value.toFixed(2); lc.className = 'val';
    }}
  }}
  if (volumeSeries && vol) {{
    lv.textContent = formatVol(vol.value);
  }}
  // Update crosshair on sub-pane charts
  Object.values(subPanes).forEach(sp => {{
    if (sp.chart && param.time) {{
      sp.chart.setCrosshairPosition(undefined, undefined, sp.series);
    }}
  }});
}});

// ========== MULTI-PANE INDICATOR SYSTEM ==========

const chartsContainer = document.getElementById('charts-container');
const subPanes = {{}};  // {{ id: {{ chart, series, svg, container, divider, cleanup }} }}
let syncingTimeScale = false;

// Sync main chart time scale -> sub-panes
chart.timeScale().subscribeVisibleLogicalRangeChange(range => {{
  if (syncingTimeScale) return;
  syncingTimeScale = true;
  Object.values(subPanes).forEach(sp => {{
    if (sp.chart) sp.chart.timeScale().setVisibleLogicalRange(range);
  }});
  syncingTimeScale = false;
}});

function createSubPane(id, label, height) {{
  // Divider
  const divider = document.createElement('div');
  divider.className = 'pane-divider';
  chartsContainer.appendChild(divider);

  // Pane container
  const paneDiv = document.createElement('div');
  paneDiv.className = 'chart-pane';
  paneDiv.id = 'pane-' + id;
  paneDiv.style.height = height + 'px';
  paneDiv.style.flexShrink = '0';
  chartsContainer.appendChild(paneDiv);

  // Label
  const lbl = document.createElement('div');
  lbl.className = 'pane-label';
  lbl.textContent = label;
  paneDiv.appendChild(lbl);

  // Chart container
  const chartDiv = document.createElement('div');
  chartDiv.className = 'pane-chart';
  paneDiv.appendChild(chartDiv);

  // Drawing SVG
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'pane-svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  paneDiv.appendChild(svg);

  // Create chart
  const subChart = LightweightCharts.createChart(chartDiv, {{
    autoSize: true,
    layout: {{ background: {{ type: 'solid', color: '#0a0a0f' }}, textColor: '#e0e0e0' }},
    grid: {{ vertLines: {{ color: '#1a1a24' }}, horzLines: {{ color: '#1a1a24' }} }},
    crosshair: {{ mode: LightweightCharts.CrosshairMode.Normal }},
    rightPriceScale: {{ borderColor: '#1e1e28' }},
    timeScale: {{ borderColor: '#1e1e28', timeVisible: {time_visible}, secondsVisible: false, visible: true }},
  }});

  // Sync sub-pane time scale -> main chart
  subChart.timeScale().subscribeVisibleLogicalRangeChange(range => {{
    if (syncingTimeScale) return;
    syncingTimeScale = true;
    chart.timeScale().setVisibleLogicalRange(range);
    Object.values(subPanes).forEach(sp => {{
      if (sp.chart && sp.chart !== subChart) sp.chart.timeScale().setVisibleLogicalRange(range);
    }});
    syncingTimeScale = false;
  }});

  // Crosshair sync: sub-pane -> main
  subChart.subscribeCrosshairMove(param => {{
    if (param.time) {{
      // Find candle data for this time to set crosshair on main
      // (lightweight-charts handles this via time sync)
    }}
  }});

  // Divider drag resize
  let startY = 0, startH = 0;
  divider.addEventListener('mousedown', e => {{
    startY = e.clientY;
    startH = paneDiv.offsetHeight;
    divider.classList.add('dragging');
    const onMove = ev => {{
      const newH = Math.max(60, startH - (ev.clientY - startY));
      paneDiv.style.height = newH + 'px';
    }};
    const onUp = () => {{
      divider.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }};
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }});

  // Wire drawing events on this pane's SVG
  setupPaneSvgEvents(id, svg, subChart, null);

  const pane = {{ chart: subChart, series: null, svg, container: paneDiv, divider, chartDiv }};
  subPanes[id] = pane;
  return pane;
}}

function destroySubPane(id) {{
  const sp = subPanes[id];
  if (!sp) return;
  sp.chart.remove();
  sp.container.remove();
  sp.divider.remove();
  // Remove drawings that belong to this pane
  drawings = drawings.filter(d => d.paneId !== id);
  saveDrawings();
  delete subPanes[id];
}}

// ---------- Indicators Panel ----------
document.getElementById('btn-indicators-toggle').addEventListener('click', () => {{
  const panel = document.getElementById('indicators-panel');
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'flex';
  const btn = document.getElementById('btn-indicators-toggle');
  btn.classList.toggle('open', !isOpen);
  btn.innerHTML = isOpen ? '&#128202; Indicators &#9660;' : '&#128202; Indicators &#9650;';
}});

// Volume indicator toggle
document.getElementById('ind-volume').addEventListener('change', (e) => {{
  const on = e.target.checked;
  document.getElementById('vol-legend').style.display = on ? '' : 'none';
  if (on) {{
    const pane = createSubPane('volume', 'Volume', 150);
    volumeSeries = pane.chart.addHistogramSeries({{
      priceFormat: {{ type: 'volume' }},
      priceScaleId: 'vol',
    }});
    pane.series = volumeSeries;
    volumeSeries.setData(ALL_VOLUME.slice(0, currentIndex));
    // Sync time range
    try {{
      const range = chart.timeScale().getVisibleLogicalRange();
      if (range) pane.chart.timeScale().setVisibleLogicalRange(range);
    }} catch(e) {{}}
    redrawAll();
  }} else {{
    volumeSeries = null;
    destroySubPane('volume');
    redrawAll();
  }}
}});

// ---------- Drawing Engine ----------

const TOOLS = {{
  trendline: {{ label: 'Trend Line',  nPoints: 2 }},
  ray:       {{ label: 'Ray',         nPoints: 2 }},
  extended:  {{ label: 'Extended',    nPoints: 2 }},
  hline:     {{ label: 'H-Line',      nPoints: 1 }},
  hray:      {{ label: 'H-Ray',       nPoints: 1 }},
  vline:     {{ label: 'V-Line',      nPoints: 1 }},
  cross:     {{ label: 'Cross',       nPoints: 1 }},
  info:      {{ label: 'Info Line',   nPoints: 2 }},
  angle:     {{ label: 'Trend Angle', nPoints: 2 }},
  parallel_channel:  {{ label: 'Parallel Channel',  nPoints: 3 }},
  regression_trend:  {{ label: 'Regression Trend',  nPoints: 2 }},
  flat_top_bottom:   {{ label: 'Flat Top/Bottom',   nPoints: 3 }},
  disjoint_channel:  {{ label: 'Disjoint Channel',  nPoints: 4 }},

}};

let activeTool    = null;   // null = cursor
let pendingPoints = [];     // [{{time, price}}] — in-progress placement
let mouseXY       = {{x: 0, y: 0}}; // cursor in SVG-local px
let drawings      = [];     // [{{id, type, points, color, lineWidth, paneId}}]
let activePane    = 'main'; // which pane is being drawn on

const drawingSvg = document.getElementById('drawing-svg');

// --- Pane-aware coordinate helpers ---
function getPaneChart(paneId) {{
  if (paneId === 'main') return chart;
  return subPanes[paneId] ? subPanes[paneId].chart : chart;
}}

function getPaneSeries(paneId) {{
  if (paneId === 'main') return candleSeries;
  return subPanes[paneId] ? subPanes[paneId].series : candleSeries;
}}

function getPaneSvg(paneId) {{
  if (paneId === 'main') return drawingSvg;
  return subPanes[paneId] ? subPanes[paneId].svg : drawingSvg;
}}

function toScreen(time, price, paneId) {{
  const c = getPaneChart(paneId || 'main');
  const s = getPaneSeries(paneId || 'main');
  return {{
    x: c.timeScale().timeToCoordinate(time),
    y: s ? s.priceToCoordinate(price) : null,
  }};
}}

function fromScreen(x, y, paneId) {{
  const c = getPaneChart(paneId || 'main');
  const s = getPaneSeries(paneId || 'main');
  return {{
    time:  c.timeScale().coordinateToTime(x),
    price: s ? s.coordinateToPrice(y) : null,
  }};
}}

function getSvgSize(paneId) {{
  const svg = getPaneSvg(paneId || 'main');
  const r = svg.getBoundingClientRect();
  return {{ W: r.width, H: r.height }};
}}

// Extend ray from (x1,y1) through (x2,y2) to the SVG bounding box edge
function rayEndpoint(x1, y1, x2, y2, W, H) {{
  const dx = x2 - x1, dy = y2 - y1;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return {{ x: x2, y: y2 }};
  let t = Infinity;
  if (dx > 0) t = Math.min(t, (W - x1) / dx);
  else if (dx < 0) t = Math.min(t, -x1 / dx);
  if (dy > 0) t = Math.min(t, (H - y1) / dy);
  else if (dy < 0) t = Math.min(t, -y1 / dy);
  return {{ x: x1 + dx * t, y: y1 + dy * t }};
}}

// --- SVG primitive helpers ---
const uid = () => Math.random().toString(36).slice(2, 9);

const svgLine = (a, b, col, w, dash = '') =>
  `<line x1="${{a.x.toFixed(1)}}" y1="${{a.y.toFixed(1)}}"
         x2="${{b.x.toFixed(1)}}" y2="${{b.y.toFixed(1)}}"
         stroke="${{col}}" stroke-width="${{w}}" stroke-linecap="round"
         ${{dash ? `stroke-dasharray="${{dash}}"` : ''}} />`;

const svgDot = (p, col, r = 3) =>
  `<circle cx="${{p.x.toFixed(1)}}" cy="${{p.y.toFixed(1)}}"
           r="${{r}}" fill="${{col}}" />`;

const svgTxt = (p, text, col) =>
  `<text x="${{p.x.toFixed(1)}}" y="${{p.y.toFixed(1)}}"
         fill="${{col}}" font-size="11"
         font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">${{text}}</text>`;

const svgPolygon = (points, fillColor) =>
  `<polygon points="${{points.map(p => p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ')}}"
            fill="${{fillColor}}" stroke="none" />`;

// --- linearRegression helper ---
function linearRegression(times, prices) {{
  const n = times.length;
  if (n < 2) return {{ slope: 0, intercept: prices[0] || 0, stddev: 0 }};
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) {{
    sx += times[i]; sy += prices[i];
    sxx += times[i] * times[i];
    sxy += times[i] * prices[i];
  }}
  const denom = n * sxx - sx * sx;
  const slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0;
  const intercept = (sy - slope * sx) / n;
  let sse = 0;
  for (let i = 0; i < n; i++) {{
    const res = prices[i] - (slope * times[i] + intercept);
    sse += res * res;
  }}
  const stddev = Math.sqrt(sse / n);
  return {{ slope, intercept, stddev }};
}}

// --- renderDrawing ---
function renderDrawing(d, W, H, ghost = false, paneId) {{
  const stroke = ghost ? d.color + '99' : d.color;
  const strokeW = d.lineWidth;
  const dash = ghost ? '6,4' : '';
  const drawPaneId = paneId || d.paneId || 'main';
  const pts = d.points.map(p => toScreen(p.time, p.price, drawPaneId));

  let html = '';
  switch (d.type) {{

    case 'trendline': {{
      if (pts.some(p => p.x === null || p.y === null)) break;
      if (pts.length >= 2) {{
        html += svgLine(pts[0], pts[1], stroke, strokeW, dash);
        html += svgDot(pts[0], stroke);
        html += svgDot(pts[1], stroke);
      }} else if (pts.length === 1) {{
        html += svgDot(pts[0], stroke);
      }}
      break;
    }}

    case 'ray': {{
      if (pts.some(p => p.x === null || p.y === null)) break;
      if (pts.length >= 2) {{
        const end = rayEndpoint(pts[0].x, pts[0].y, pts[1].x, pts[1].y, W, H);
        html += svgLine(pts[0], end, stroke, strokeW, dash);
        html += svgDot(pts[0], stroke);
        html += svgDot(pts[1], stroke);
      }} else if (pts.length === 1) {{
        html += svgDot(pts[0], stroke);
      }}
      break;
    }}

    case 'extended': {{
      if (pts.some(p => p.x === null || p.y === null)) break;
      if (pts.length >= 2) {{
        const fwd = rayEndpoint(pts[0].x, pts[0].y, pts[1].x, pts[1].y, W, H);
        const bwd = rayEndpoint(pts[1].x, pts[1].y, pts[0].x, pts[0].y, W, H);
        html += svgLine(bwd, fwd, stroke, strokeW, dash);
        html += svgDot(pts[0], stroke);
        html += svgDot(pts[1], stroke);
      }} else if (pts.length === 1) {{
        html += svgDot(pts[0], stroke);
      }}
      break;
    }}

    case 'hline': {{
      if (pts[0].y === null) break;
      const hy = pts[0].y;
      html += svgLine({{ x: 0, y: hy }}, {{ x: W, y: hy }}, stroke, strokeW, dash);
      if (!ghost) {{
        html += svgTxt({{ x: W - 54, y: hy - 4 }}, d.points[0].price.toFixed(2), stroke);
      }}
      break;
    }}

    case 'hray': {{
      if (pts[0].x === null || pts[0].y === null) break;
      html += svgLine(pts[0], {{ x: W, y: pts[0].y }}, stroke, strokeW, dash);
      html += svgDot(pts[0], stroke);
      break;
    }}

    case 'vline': {{
      if (pts[0].x === null) break;
      const vx = pts[0].x;
      html += svgLine({{ x: vx, y: 0 }}, {{ x: vx, y: H }}, stroke, strokeW, dash);
      break;
    }}

    case 'cross': {{
      if (pts[0].x === null || pts[0].y === null) break;
      const {{ x: cx, y: cy }} = pts[0];
      html += svgLine({{ x: 0, y: cy }}, {{ x: W, y: cy }}, stroke, strokeW, dash);
      html += svgLine({{ x: cx, y: 0 }}, {{ x: cx, y: H }}, stroke, strokeW, dash);
      html += svgDot(pts[0], stroke);
      break;
    }}

    case 'info': {{
      if (pts.some(p => p.x === null || p.y === null)) break;
      if (pts.length >= 2) {{
        html += svgLine(pts[0], pts[1], stroke, strokeW, dash);
        html += svgDot(pts[0], stroke);
        html += svgDot(pts[1], stroke);
        if (!ghost) {{
          const delta = d.points[1].price - d.points[0].price;
          const pct   = (delta / d.points[0].price * 100).toFixed(2);
          const sign  = delta >= 0 ? '+' : '';
          const label = `${{sign}}${{delta.toFixed(2)}} (${{sign}}${{pct}}%)`;
          const mx = (pts[0].x + pts[1].x) / 2;
          const my = (pts[0].y + pts[1].y) / 2 - 8;
          html += svgTxt({{ x: mx, y: my }}, label, stroke);
        }}
      }} else if (pts.length === 1) {{
        html += svgDot(pts[0], stroke);
      }}
      break;
    }}

    case 'angle': {{
      if (pts.some(p => p.x === null || p.y === null)) break;
      if (pts.length >= 2) {{
        html += svgLine(pts[0], pts[1], stroke, strokeW, dash);
        html += svgDot(pts[0], stroke);
        html += svgDot(pts[1], stroke);
        const dx = pts[1].x - pts[0].x;
        const dy = pts[1].y - pts[0].y;
        const deg = (Math.atan2(-dy, dx) * 180 / Math.PI).toFixed(1);
        const mx = (pts[0].x + pts[1].x) / 2 + 6;
        const my = (pts[0].y + pts[1].y) / 2 - 6;
        html += svgTxt({{ x: mx, y: my }}, `${{deg}}°`, stroke);
      }} else if (pts.length === 1) {{
        html += svgDot(pts[0], stroke);
      }}
      break;
    }}

    case 'parallel_channel': {{
      if (pts.some(p => p.x === null || p.y === null)) break;
      const fill = ghost ? 'rgba(240,185,11,0.04)' : 'rgba(240,185,11,0.08)';
      if (pts.length >= 3) {{
        // Baseline: pts[0] -> pts[1], extended both ways
        const fwd1 = rayEndpoint(pts[0].x, pts[0].y, pts[1].x, pts[1].y, W, H);
        const bwd1 = rayEndpoint(pts[1].x, pts[1].y, pts[0].x, pts[0].y, W, H);
        // Parallel line through pts[2] with same slope
        const dx = pts[1].x - pts[0].x;
        const dy = pts[1].y - pts[0].y;
        const p2a = {{ x: pts[2].x, y: pts[2].y }};
        const p2b = {{ x: pts[2].x + dx, y: pts[2].y + dy }};
        const fwd2 = rayEndpoint(p2a.x, p2a.y, p2b.x, p2b.y, W, H);
        const bwd2 = rayEndpoint(p2b.x, p2b.y, p2a.x, p2a.y, W, H);
        html += svgPolygon([bwd1, fwd1, fwd2, bwd2], fill);
        html += svgLine(bwd1, fwd1, stroke, strokeW, dash);
        html += svgLine(bwd2, fwd2, stroke, strokeW, dash);
        html += svgDot(pts[0], stroke);
        html += svgDot(pts[1], stroke);
        html += svgDot(pts[2], stroke);
      }} else if (pts.length === 2) {{
        const fwd = rayEndpoint(pts[0].x, pts[0].y, pts[1].x, pts[1].y, W, H);
        const bwd = rayEndpoint(pts[1].x, pts[1].y, pts[0].x, pts[0].y, W, H);
        html += svgLine(bwd, fwd, stroke, strokeW, dash);
        html += svgDot(pts[0], stroke);
        html += svgDot(pts[1], stroke);
      }} else if (pts.length === 1) {{
        html += svgDot(pts[0], stroke);
      }}
      break;
    }}

    case 'regression_trend': {{
      if (pts.some(p => p.x === null || p.y === null)) break;
      const fill = ghost ? 'rgba(240,185,11,0.04)' : 'rgba(240,185,11,0.08)';
      if (pts.length >= 2) {{
        // Find candles in the time range
        const t0 = Math.min(d.points[0].time, d.points[1].time);
        const t1 = Math.max(d.points[0].time, d.points[1].time);
        const subset = ALL_CANDLES.filter(c => {{
          const ct = typeof c.time === 'number' ? c.time : new Date(c.time).getTime() / 1000;
          const tt0 = typeof t0 === 'number' ? t0 : new Date(t0).getTime() / 1000;
          const tt1 = typeof t1 === 'number' ? t1 : new Date(t1).getTime() / 1000;
          return ct >= tt0 && ct <= tt1;
        }});
        if (subset.length >= 2) {{
          // Use screen-x coordinates for regression
          const screenPts = subset.map(c => {{
            const sx = chart.timeScale().timeToCoordinate(c.time);
            const sy = candleSeries.priceToCoordinate(c.close);
            return {{ x: sx, y: sy }};
          }}).filter(p => p.x !== null && p.y !== null);
          if (screenPts.length >= 2) {{
            const xs = screenPts.map(p => p.x);
            const ys = screenPts.map(p => p.y);
            const reg = linearRegression(xs, ys);
            // Center line endpoints at SVG edges
            const yAt0 = reg.intercept;
            const yAtW = reg.slope * W + reg.intercept;
            const centerA = {{ x: 0, y: yAt0 }};
            const centerB = {{ x: W, y: yAtW }};
            // Upper / lower bands
            const upperA = {{ x: 0, y: yAt0 - reg.stddev }};
            const upperB = {{ x: W, y: yAtW - reg.stddev }};
            const lowerA = {{ x: 0, y: yAt0 + reg.stddev }};
            const lowerB = {{ x: W, y: yAtW + reg.stddev }};
            html += svgPolygon([upperA, upperB, lowerB, lowerA], fill);
            html += svgLine(centerA, centerB, stroke, strokeW, dash);
            html += svgLine(upperA, upperB, stroke, 0.7, '4,3');
            html += svgLine(lowerA, lowerB, stroke, 0.7, '4,3');
          }}
        }}
        html += svgDot(pts[0], stroke);
        html += svgDot(pts[1], stroke);
      }} else if (pts.length === 1) {{
        html += svgDot(pts[0], stroke);
      }}
      break;
    }}

    case 'flat_top_bottom': {{
      if (pts.some(p => p.x === null || p.y === null)) break;
      const fill = ghost ? 'rgba(240,185,11,0.04)' : 'rgba(240,185,11,0.08)';
      if (pts.length >= 3) {{
        // Sloped line: pts[0] -> pts[1], extended both ways
        const fwd1 = rayEndpoint(pts[0].x, pts[0].y, pts[1].x, pts[1].y, W, H);
        const bwd1 = rayEndpoint(pts[1].x, pts[1].y, pts[0].x, pts[0].y, W, H);
        // Horizontal line at pts[2].price
        const hy = pts[2].y;
        const hA = {{ x: 0, y: hy }};
        const hB = {{ x: W, y: hy }};
        html += svgPolygon([bwd1, fwd1, hB, hA], fill);
        html += svgLine(bwd1, fwd1, stroke, strokeW, dash);
        html += svgLine(hA, hB, stroke, strokeW, dash);
        html += svgDot(pts[0], stroke);
        html += svgDot(pts[1], stroke);
        html += svgDot(pts[2], stroke);
      }} else if (pts.length === 2) {{
        const fwd = rayEndpoint(pts[0].x, pts[0].y, pts[1].x, pts[1].y, W, H);
        const bwd = rayEndpoint(pts[1].x, pts[1].y, pts[0].x, pts[0].y, W, H);
        html += svgLine(bwd, fwd, stroke, strokeW, dash);
        html += svgDot(pts[0], stroke);
        html += svgDot(pts[1], stroke);
      }} else if (pts.length === 1) {{
        html += svgDot(pts[0], stroke);
      }}
      break;
    }}

    case 'disjoint_channel': {{
      if (pts.some(p => p.x === null || p.y === null)) break;
      const fill = ghost ? 'rgba(240,185,11,0.04)' : 'rgba(240,185,11,0.08)';
      if (pts.length >= 4) {{
        // Top line: pts[0] -> pts[1], extended both ways
        const fwd1 = rayEndpoint(pts[0].x, pts[0].y, pts[1].x, pts[1].y, W, H);
        const bwd1 = rayEndpoint(pts[1].x, pts[1].y, pts[0].x, pts[0].y, W, H);
        // Bottom line: pts[2] -> pts[3], extended both ways
        const fwd2 = rayEndpoint(pts[2].x, pts[2].y, pts[3].x, pts[3].y, W, H);
        const bwd2 = rayEndpoint(pts[3].x, pts[3].y, pts[2].x, pts[2].y, W, H);
        html += svgPolygon([bwd1, fwd1, fwd2, bwd2], fill);
        html += svgLine(bwd1, fwd1, stroke, strokeW, dash);
        html += svgLine(bwd2, fwd2, stroke, strokeW, dash);
        html += svgDot(pts[0], stroke);
        html += svgDot(pts[1], stroke);
        html += svgDot(pts[2], stroke);
        html += svgDot(pts[3], stroke);
      }} else if (pts.length === 3) {{
        const fwd1 = rayEndpoint(pts[0].x, pts[0].y, pts[1].x, pts[1].y, W, H);
        const bwd1 = rayEndpoint(pts[1].x, pts[1].y, pts[0].x, pts[0].y, W, H);
        html += svgLine(bwd1, fwd1, stroke, strokeW, dash);
        html += svgDot(pts[0], stroke);
        html += svgDot(pts[1], stroke);
        html += svgDot(pts[2], stroke);
      }} else if (pts.length === 2) {{
        const fwd = rayEndpoint(pts[0].x, pts[0].y, pts[1].x, pts[1].y, W, H);
        const bwd = rayEndpoint(pts[1].x, pts[1].y, pts[0].x, pts[0].y, W, H);
        html += svgLine(bwd, fwd, stroke, strokeW, dash);
        html += svgDot(pts[0], stroke);
        html += svgDot(pts[1], stroke);
      }} else if (pts.length === 1) {{
        html += svgDot(pts[0], stroke);
      }}
      break;
    }}


  }}
  return html;
}}

// --- redrawAll ---
function redrawAll() {{
  // Render on main pane
  renderPaneDrawings('main');
  // Render on each sub-pane
  Object.keys(subPanes).forEach(id => renderPaneDrawings(id));
}}

function renderPaneDrawings(paneId) {{
  const svg = getPaneSvg(paneId);
  const {{ W, H }} = getSvgSize(paneId);
  let html = '';

  // Render committed drawings for this pane
  for (const d of drawings) {{
    if ((d.paneId || 'main') !== paneId) continue;
    html += renderDrawing(d, W, H, false, paneId);
  }}

  // Render ghost (in-progress) drawing on the active pane
  if (activeTool && pendingPoints.length > 0 && activePane === paneId) {{
    const ghostPts = [...pendingPoints];
    const hover = fromScreen(mouseXY.x, mouseXY.y, paneId);
    if (hover.time !== null && hover.price !== null &&
        ghostPts.length < TOOLS[activeTool].nPoints) {{
      ghostPts.push(hover);
    }}
    if (ghostPts.length >= 1) {{
      html += renderDrawing({{
        type: activeTool,
        points: ghostPts,
        color: '#f0b90b',
        lineWidth: 1,
        paneId: paneId,
      }}, W, H, true, paneId);
    }}
  }}

  // Hover price label on active pane
  if (activeTool && activePane === paneId) {{
    const hover = fromScreen(mouseXY.x, mouseXY.y, paneId);
    if (hover.price !== null) {{
      html += svgTxt(
        {{ x: mouseXY.x + 8, y: mouseXY.y - 6 }},
        hover.price.toFixed(2),
        '#f0b90b'
      );
    }}
  }}

  svg.innerHTML = html;
}}

// --- Tool activation ---
function setActiveTool(tool) {{
  activeTool = tool;
  pendingPoints = [];
  document.querySelectorAll('#draw-toolbar [data-tool]').forEach(b => {{
    b.classList.toggle('tool-active', b.dataset.tool === (tool ?? 'cursor'));
  }});
  // Toggle drawing-mode on all pane SVGs
  drawingSvg.classList.toggle('drawing-mode', tool !== null);
  Object.values(subPanes).forEach(sp => {{
    sp.svg.classList.toggle('drawing-mode', tool !== null);
  }});
  redrawAll();
}}

document.querySelectorAll('#draw-toolbar [data-tool]').forEach(btn => {{
  btn.addEventListener('click', () => {{
    const tool = btn.dataset.tool === 'cursor' ? null : btn.dataset.tool;
    setActiveTool(tool);
  }});
}});

// --- localStorage persistence ---
const STORAGE_KEY = 'scdraw_{symbol}';

function saveDrawings() {{
  try {{ localStorage.setItem(STORAGE_KEY, JSON.stringify(drawings)); }} catch(e) {{}}
}}

function loadDrawings() {{
  try {{
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) drawings = JSON.parse(s);
  }} catch(e) {{}}
}}

// --- Plot area bounds helper ---
function getPlotBounds(paneId) {{
  const c = getPaneChart(paneId);
  const chartDiv = paneId === 'main' ? document.getElementById('chart') : subPanes[paneId].chartDiv;
  const plotW = c.timeScale().width();
  const table = chartDiv.querySelector('table');
  let timeScaleH = 28;
  if (table && table.rows.length >= 2) {{
    timeScaleH = table.rows[table.rows.length - 1].clientHeight;
  }}
  const plotH = chartDiv.clientHeight - timeScaleH;
  return {{ w: plotW, h: plotH }};
}}

// --- Mouse handlers ---
function setupPaneSvgEvents(paneId, svg, paneChart, paneSeries) {{
  svg.addEventListener('mousedown', e => {{
    if (!activeTool) return;
    activePane = paneId;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    // Reject clicks on axes
    const bounds = getPlotBounds(paneId);
    if (x < 0 || x > bounds.w || y < 0 || y > bounds.h) return;
    const pt = fromScreen(x, y, paneId);
    if (pt.time === null || pt.price === null) return;

    pendingPoints.push(pt);

    if (pendingPoints.length >= TOOLS[activeTool].nPoints) {{
      drawings.push({{
        id: uid(), type: activeTool,
        points: [...pendingPoints],
        color: '#f0b90b', lineWidth: 1,
        paneId: paneId,
      }});
      pendingPoints = [];
      saveDrawings();
      redrawAll();
    }}
  }});

  svg.addEventListener('mousemove', e => {{
    activePane = paneId;
    const rect = svg.getBoundingClientRect();
    mouseXY = {{ x: e.clientX - rect.left, y: e.clientY - rect.top }};
    if (activeTool) redrawAll();
  }});
}}

// Set up events for main pane
setupPaneSvgEvents('main', drawingSvg, chart, candleSeries);

// --- Keyboard shortcuts (drawing) ---
document.addEventListener('keydown', e => {{
  if (e.code === 'Escape') {{
    pendingPoints = [];
    redrawAll();
  }}
  if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) {{
    e.preventDefault();
    drawings.pop();
    saveDrawings();
    redrawAll();
  }}
}});

// --- Undo / Clear All buttons ---
document.getElementById('btn-undo').addEventListener('click', () => {{
  drawings.pop();
  saveDrawings();
  redrawAll();
}});

document.getElementById('btn-clear-all').addEventListener('click', () => {{
  drawings = [];
  pendingPoints = [];
  saveDrawings();
  redrawAll();
}});

// --- Sidebar collapse/expand ---
document.getElementById('sidebar-toggle').addEventListener('click', () => {{
  const tb = document.getElementById('draw-toolbar');
  const btn = document.getElementById('sidebar-toggle');
  tb.classList.toggle('collapsed');
  btn.innerHTML = tb.classList.contains('collapsed') ? '&#9654;' : '&#9664;';
}});

// --- Lines group collapse/expand ---
document.getElementById('lines-header').addEventListener('click', () => {{
  const grp = document.getElementById('lines-group');
  const arrow = document.querySelector('#lines-header .arrow');
  grp.classList.toggle('collapsed-group');
  arrow.innerHTML = grp.classList.contains('collapsed-group') ? '&#9654;' : '&#9660;';
}});

// --- Channels group collapse/expand ---
document.getElementById('channels-header').addEventListener('click', () => {{
  const grp = document.getElementById('channels-group');
  const arrow = document.querySelector('#channels-header .arrow');
  grp.classList.toggle('collapsed-group');
  arrow.innerHTML = grp.classList.contains('collapsed-group') ? '&#9654;' : '&#9660;';
}});


// --- Sync SVG bounds to match plot area (exclude axes) ---
function syncSvgBounds() {{
  syncPaneSvgBounds('main', chart, document.getElementById('chart'), drawingSvg);
  Object.keys(subPanes).forEach(id => {{
    const sp = subPanes[id];
    syncPaneSvgBounds(id, sp.chart, sp.chartDiv, sp.svg);
  }});
}}

function syncPaneSvgBounds(paneId, paneChart, chartDiv, svg) {{
  try {{
    const plotW = paneChart.timeScale().width();
    // Find time scale height by measuring the chart's internal table
    const table = chartDiv.querySelector('table');
    let timeScaleH = 28; // default fallback
    if (table && table.rows.length >= 2) {{
      timeScaleH = table.rows[table.rows.length - 1].clientHeight;
    }}
    const plotH = chartDiv.clientHeight - timeScaleH;
    svg.setAttribute('width', Math.max(0, plotW));
    svg.setAttribute('height', Math.max(0, plotH));
    svg.style.width = Math.max(0, plotW) + 'px';
    svg.style.height = Math.max(0, plotH) + 'px';
  }} catch(e) {{}}
}}

// --- Auto-redraw on pan/zoom/resize ---
chart.timeScale().subscribeVisibleLogicalRangeChange(() => {{ syncSvgBounds(); redrawAll(); }});
const chartsContainerEl = document.getElementById('charts-container');
new ResizeObserver(() => {{ syncSvgBounds(); redrawAll(); }}).observe(chartsContainerEl);

// --- Init ---
loadDrawings();
syncSvgBounds();
redrawAll();
</script>
</body>
</html>"""


def main():
    params = get_user_input()
    if not params:
        sys.exit(0)

    symbol = params["symbol"]
    interval = params["interval"]
    df = fetch_data(symbol, params["start"], params["end"], interval)

    if df.empty:
        messagebox.showerror("No Data", f"No data returned for {symbol}. Check the ticker and date range.")
        sys.exit(1)

    is_intraday = interval in ("1h", "4h")

    # Prepare data for Lightweight Charts
    candle_data = []
    volume_data = []
    for ts, row in df.iterrows():
        if is_intraday:
            t = int(ts.timestamp())
        else:
            t = ts.strftime("%Y-%m-%d")
        o, h, l, c = float(row["Open"]), float(row["High"]), float(row["Low"]), float(row["Close"])
        v = float(row["Volume"])
        candle_data.append({"time": t, "open": o, "high": h, "low": l, "close": c})
        color = "#26a69a80" if c >= o else "#ef535080"
        volume_data.append({"time": t, "value": v, "color": color})

    html = build_chart_html(symbol, candle_data, volume_data, is_intraday)

    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False, encoding="utf-8") as f:
        f.write(html)
        webbrowser.open(f"file:///{f.name}")


if __name__ == "__main__":
    main()
