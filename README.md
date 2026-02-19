# OpenFinCh - Open Financial Charts

Interactive stock charting application with candlestick charts, drawing tools, technical indicators, and bar replay.

## Features

- Candlestick, line, and area chart types
- Drawing tools: trend lines, rays, channels, horizontal/vertical lines, and more
- Bar replay with adjustable speed
- Volume indicator with separate sub-pane
- Dark theme with amber accents
- Persistent drawings via localStorage

## Installation

```bash
pip install -r requirements.txt
```

## Usage

```bash
python -m openfinch.stock_chart
```

This opens a dialog to enter a ticker symbol, date range, and interval, then displays an interactive chart in your browser.

## Project Structure

```
openfinch/       - Main application package
indicators/      - Technical indicator implementations
tests/           - Debug and test scripts
```

## Requirements

- Python 3.8+
- yfinance
- pandas
- tkinter (included with Python)

## License

See [LICENSE.txt](LICENSE.txt) for details.
