# GUI — Stock Chart Application

This folder contains the GUI/frontend components for the yfinance stock chart viewer.
These files are separated from the core `yfinance` library to keep the library clean and focused.

## Files

| File | Description |
|------|-------------|
| `stock_chart.py` | Main application — tkinter input dialog + HTML chart generation with drawing tools |
| `test_chart_debug.py` | Debug utility — generates a static chart HTML for testing |
| `test_chart_debug2.py` | Debug utility — generates a chart with diagnostic overlay for drawing tool troubleshooting |
| `debug_chart.html` | Generated debug chart output (gitignored) |
| `debug_chart2.html` | Generated debug chart output with diagnostics (gitignored) |

## Running

From this folder (or from the project root), run:

```bash
python gui/stock_chart.py
```

The GUI will prompt for a ticker symbol, date range, and interval, then open an interactive chart in your browser.

## Dependencies

- **yfinance** (the parent `yfinance/` package — automatically added to `sys.path`)
- **pandas**
- **tkinter** (included with Python)
