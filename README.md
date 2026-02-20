# OpenFinCh - Open Financial Charts

Interactive stock charting application built with Python and [Lightweight Charts](https://tradingview.github.io/lightweight-charts/). Runs as a local web server — no cloud services, no API keys.

![Python 3.8+](https://img.shields.io/badge/python-3.8%2B-blue)

## Features

- **Multiple chart types** — Candlestick, Line, and Area
- **18 built-in intervals** — From 1-minute to 12-month, plus custom intervals
- **Technical indicators** — SMA, EMA, MACD, Bollinger Bands, ADX, Aroon, Aroon Oscillator, ATR, SuperTrend, VWMA, Volume
- **Editable ticker** — Change stocks directly on the chart without restarting
- **Custom intervals** — Enter any interval (e.g. 10 min, 2 hours, 6 months) via the custom interval input
- **Dark theme** with amber accents
- **Zero configuration** — Just install and run

## Installation

```bash
pip install -r requirements.txt
```

**Requirements:** Python 3.8+, [yfinance](https://github.com/ranaroussi/yfinance), [pandas](https://pandas.pydata.org/)

## Usage

```bash
python -m openfinch
```

This starts a local server at `http://127.0.0.1:8765` and opens the chart in your default browser.

- Click the ticker symbol in the header to change stocks
- Use the interval buttons to switch timeframes
- Select "Custom..." to enter any interval
- Add indicators from the dropdown menu

## Project Structure

```
openfinch/
  __init__.py        - Package init
  __main__.py        - Entry point (python -m openfinch)
  server.py          - Local HTTP server with JSON API
  stock_chart.py     - Chart page generator (HTML/CSS/JS)
  intervals/
    __init__.py      - Interval definitions and data fetching
indicators/
  moving_averages/   - Moving average implementations
```

## How It Works

OpenFinCh runs a lightweight HTTP server on your machine. When you open the page, it fetches stock data via [yfinance](https://github.com/ranaroussi/yfinance) and renders an interactive chart using TradingView's [Lightweight Charts](https://tradingview.github.io/lightweight-charts/) library. All indicator calculations (SMA, EMA, MACD, Bollinger Bands, etc.) run client-side in JavaScript.

## License

See [LICENSE.txt](LICENSE.txt) for details.
