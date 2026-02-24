# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

```
OpenFinCh/
├── CLAUDE.md
├── requirements.txt          # yfinance, pandas, fastapi, uvicorn
├── openfinch/
│   ├── __init__.py
│   ├── __main__.py           # Entry point: calls start_server()
│   ├── server.py             # FastAPI app + all API endpoints
│   ├── stock_chart.py        # Generates entire SPA as a Python f-string (~4300 lines)
│   ├── edgar.py              # SEC EDGAR 13F institutional holdings
│   └── intervals/
│       ├── __init__.py       # INTERVALS dict, concurrent fetching, resampling
│       └── db.py             # SQLite cache (openfinch_cache.db)
└── openfinch_cache.db        # Auto-generated SQLite cache
```

## Running the App

```bash
pip install -r requirements.txt
python -m openfinch
```

Opens a browser at `http://127.0.0.1:8765`. Stop with `Ctrl+C`. There are no automated tests.

## Dependencies

- **yfinance** — stock data fetching
- **pandas** — DataFrame manipulation and resampling
- **fastapi** — web framework for API endpoints
- **uvicorn** — ASGI server

## Architecture

OpenFinCh is a single-process Python HTTP server that serves a dynamically generated single-page application for stock charting.

### Backend (`openfinch/server.py`)

A **FastAPI** application served by **Uvicorn**. `GET /` returns the full HTML page. All data endpoints are `POST /api/*`:

| Endpoint | Data source |
|---|---|
| `/api/data` | `intervals/__init__.py` → yfinance (concurrent) |
| `/api/custom_interval` | Same, with pandas `resample()` |
| `/api/news` | Google News RSS via `urlopen` |
| `/api/profile`, `/api/analysts`, `/api/financials`, `/api/insiders` | yfinance `Ticker` methods |
| `/api/holders` | `edgar.py` → SEC EDGAR 13F filings |
| `/api/search` | Yahoo Finance symbol search API |

The server **reloads `stock_chart.py`** on every `GET /` request, so changes to the frontend take effect without restart.

### Frontend (`openfinch/stock_chart.py`)

`build_chart_html(default_symbol)` returns the **entire SPA as a single Python string** — there are no separate HTML/CSS/JS files. All TradingView Lightweight Charts integration, indicator math (SMA, EMA, MACD, Bollinger Bands, SuperTrend, VWMA, ADX, Aroon, ATR), and UI event handling live here as embedded JavaScript. Edit this file to change any visual or interactive behavior.

### Interval System (`openfinch/intervals/__init__.py`)

`INTERVALS` dict defines 18 built-in timeframes (1m → 12mo). `fetch_all_intervals(symbol)` uses `ThreadPoolExecutor(10 workers)` to fetch them in parallel. Custom intervals use the closest smaller source interval, then `pandas.resample()` to aggregate candles. `prepare_chart_data(df, intraday)` converts DataFrames to the `{time, open, high, low, close, volume}` format Lightweight Charts expects.

### SQLite Cache (`openfinch/intervals/db.py`)

Caches fetched price data in `openfinch_cache.db` at the project root. **Daily+ intervals** (1d, 1wk, 1mo, 3mo) are cached permanently — fetched once, never re-fetched. **Intraday intervals** (1m, 2m, 5m, 15m, 30m, 1h) re-fetch after 15 minutes to accumulate history beyond yfinance's API limits (e.g., 1m is limited to 7 days per request, but the cache grows over weeks of use). Re-fetched data merges via `INSERT OR REPLACE` on the `(symbol, interval, timestamp)` primary key — overlapping candles update in place, new candles are appended. Schema has two tables: `metadata` (symbol, interval, last_fetched) and `price_data` (symbol, interval, timestamp, OHLCV columns).

### SEC EDGAR Cache (`openfinch/edgar.py`)

Downloads quarterly 13F ZIP files (~100 MB) to `~/.openfinch/13f/`. Subsequent calls within the same quarter use the cache. CUSIP→ticker mappings are cached in-memory during a session.

## Extending the App

**Add an API endpoint:** Add a new `@app.post("/api/name")` route in `server.py`.

**Add an interval:** Add an entry to the `INTERVALS` dict in `intervals/__init__.py` with keys `label`, `period`, `yf_interval`, `resample_rule`, and `intraday`.

**Add a technical indicator:** Add the JavaScript calculation and series registration inside `build_chart_html()` in `stock_chart.py` (alongside existing indicators like SMA/MACD).
