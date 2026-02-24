# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

```bash
pip install -r requirements.txt
python -m openfinch
```

Opens a browser at `http://127.0.0.1:8765`. Stop with `Ctrl+C`. There are no automated tests.

## Architecture

OpenFinCh is a single-process Python HTTP server that serves a dynamically generated single-page application for stock charting.

### Backend (`openfinch/server.py`)

A bare `http.server.BaseHTTPRequestHandler` subclass. `GET /` returns the full HTML page. All data endpoints are `POST /api/*`:

| Endpoint | Data source |
|---|---|
| `/api/data` | `intervals/__init__.py` → yfinance (concurrent) |
| `/api/custom_interval` | Same, with pandas `resample()` |
| `/api/news` | Google News RSS via `urlopen` |
| `/api/profile`, `/api/analysts`, `/api/financials`, `/api/insiders` | yfinance `Ticker` methods |
| `/api/holders` | `edgar.py` → SEC EDGAR 13F filings |
| `/api/search` | Yahoo Finance symbol search API |

The server **reloads modules on every request**, so changes to `server.py`, `stock_chart.py`, and `intervals/__init__.py` take effect without restart.

### Frontend (`openfinch/stock_chart.py`)

`build_chart_html(default_symbol)` returns the **entire SPA as a single Python string** — there are no separate HTML/CSS/JS files. All TradingView Lightweight Charts integration, indicator math (SMA, EMA, MACD, Bollinger Bands, SuperTrend, VWMA, ADX, Aroon, ATR), and UI event handling live here as embedded JavaScript. Edit this file to change any visual or interactive behavior.

### Interval System (`openfinch/intervals/__init__.py`)

`INTERVALS` dict defines 18 built-in timeframes (1m → 12mo). `fetch_all_intervals(symbol)` uses `ThreadPoolExecutor(10 workers)` to fetch them in parallel. Custom intervals use the closest smaller source interval, then `pandas.resample()` to aggregate candles. `prepare_chart_data(df, intraday)` converts DataFrames to the `{time, open, high, low, close, volume}` format Lightweight Charts expects.

### SEC EDGAR Cache (`openfinch/edgar.py`)

Downloads quarterly 13F ZIP files (~100 MB) to `~/.openfinch/13f/`. Subsequent calls within the same quarter use the cache. CUSIP→ticker mappings are cached in-memory during a session.

## Extending the App

**Add an API endpoint:** Add an `elif self.path == "/api/name":` branch inside `do_POST()` in `server.py`.

**Add an interval:** Add an entry to the `INTERVALS` dict in `intervals/__init__.py` with keys `label`, `period`, `yf_interval`, `resample_rule`, and `intraday`.

**Add a technical indicator:** Add the JavaScript calculation and series registration inside `build_chart_html()` in `stock_chart.py` (alongside existing indicators like SMA/MACD).
