# OpenFinCh - Open Financial Charts

Interactive stock charting application with candlestick charts, technical indicators, and switchable intervals.

## Features

- Candlestick, line, and area chart types
- Toggleable intervals (1H, 4H, 1D) directly on the chart
- Editable ticker symbol — change stocks without restarting
- Volume indicator with separate sub-pane
- Dark theme with amber accents
- Local HTTP server — no external services needed

## Installation

```bash
pip install -r requirements.txt
```

## Usage

```bash
python -m openfinch
```

This starts a local server at `http://127.0.0.1:8765` and opens the chart in your browser. Click on the ticker symbol in the header to change stocks.

## Project Structure

```
openfinch/           - Main application package
  stock_chart.py     - HTML/CSS/JS chart page generator
  server.py          - Local HTTP server
  intervals/         - Interval definitions and data fetching
indicators/          - Technical indicator implementations
```

## Requirements

- Python 3.8+
- yfinance
- pandas

## License

See [LICENSE.txt](LICENSE.txt) for details.
