"""Interval definitions and data fetching for OpenFinCh.

To add a new interval, simply add an entry to the INTERVALS dict below.
"""

import concurrent.futures
import time
import pandas as pd
import yfinance as yf
from . import db

# Initialize the cache database entirely
db.init_db()


# Each interval entry defines how to fetch and process data from yfinance.
#   label:          Display name shown on the UI button
#   period:         Max lookback period passed to yfinance
#   yf_interval:    The interval string passed to yfinance (must be yfinance-supported)
#   resample_rule:  If set, resample from yf_interval to this rule (e.g. "4h")
#   intraday:       Whether this interval uses unix timestamps (True) or date strings (False)
INTERVALS = {
    "1m": {
        "label": "1m",
        "period": "7d",
        "yf_interval": "1m",
        "resample_rule": None,
        "intraday": True,
    },
    "2m": {
        "label": "2m",
        "period": "60d",
        "yf_interval": "2m",
        "resample_rule": None,
        "intraday": True,
    },
    "3m": {
        "label": "3m",
        "period": "7d",
        "yf_interval": "1m",
        "resample_rule": "3min",
        "intraday": True,
    },
    "5m": {
        "label": "5m",
        "period": "60d",
        "yf_interval": "5m",
        "resample_rule": None,
        "intraday": True,
    },
    "10m": {
        "label": "10m",
        "period": "60d",
        "yf_interval": "5m",
        "resample_rule": "10min",
        "intraday": True,
    },
    "15m": {
        "label": "15m",
        "period": "60d",
        "yf_interval": "15m",
        "resample_rule": None,
        "intraday": True,
    },
    "30m": {
        "label": "30m",
        "period": "60d",
        "yf_interval": "30m",
        "resample_rule": None,
        "intraday": True,
    },
    "45m": {
        "label": "45m",
        "period": "60d",
        "yf_interval": "15m",
        "resample_rule": "45min",
        "intraday": True,
    },
    "1h": {
        "label": "1H",
        "period": "730d",
        "yf_interval": "1h",
        "resample_rule": None,
        "intraday": True,
    },
    "2h": {
        "label": "2H",
        "period": "730d",
        "yf_interval": "1h",
        "resample_rule": "2h",
        "intraday": True,
    },
    "3h": {
        "label": "3H",
        "period": "730d",
        "yf_interval": "1h",
        "resample_rule": "3h",
        "intraday": True,
    },
    "4h": {
        "label": "4H",
        "period": "730d",
        "yf_interval": "1h",
        "resample_rule": "4h",
        "intraday": True,
    },
    "1d": {
        "label": "1D",
        "period": "max",
        "yf_interval": "1d",
        "resample_rule": None,
        "intraday": False,
    },
    "1wk": {
        "label": "1W",
        "period": "max",
        "yf_interval": "1wk",
        "resample_rule": None,
        "intraday": False,
    },
    "1mo": {
        "label": "1M",
        "period": "max",
        "yf_interval": "1mo",
        "resample_rule": None,
        "intraday": False,
    },
    "3mo": {
        "label": "3M",
        "period": "max",
        "yf_interval": "3mo",
        "resample_rule": None,
        "intraday": False,
    },
    "6mo": {
        "label": "6M",
        "period": "max",
        "yf_interval": "1mo",
        "resample_rule": "6MS",
        "intraday": False,
    },
    "12mo": {
        "label": "12M",
        "period": "max",
        "yf_interval": "1mo",
        "resample_rule": "12MS",
        "intraday": False,
    },
}


def fetch_interval(symbol: str, interval_key: str) -> pd.DataFrame:
    """Fetch OHLCV data for a single interval from cache, fetching new data if needed."""
    cfg = INTERVALS[interval_key]
    yf_interval = cfg["yf_interval"]

    # 1. Check if we should fetch from yfinance
    if db.should_fetch(symbol, yf_interval):
        ticker = yf.Ticker(symbol)
        new_df = ticker.history(period=cfg["period"], interval=yf_interval)
        if not new_df.empty:
            db.save_data(symbol, yf_interval, new_df)

    # 2. Always load the full historical dataset from cache
    cached_df = db.get_cached_data(symbol, yf_interval)

    if cached_df.empty:
        return cached_df

    df = cached_df

    if cfg.get("resample_rule"):
        df = df.resample(cfg["resample_rule"]).agg({
            "Open": "first",
            "High": "max",
            "Low": "min",
            "Close": "last",
            "Volume": "sum",
        }).dropna()

    return df


def _resample(df: pd.DataFrame, rule: str) -> pd.DataFrame:
    """Resample OHLCV DataFrame to a coarser interval."""
    return df.resample(rule).agg({
        "Open": "first",
        "High": "max",
        "Low": "min",
        "Close": "last",
        "Volume": "sum",
    }).dropna()


def prepare_chart_data(df: pd.DataFrame, intraday: bool) -> dict:
    """Convert a DataFrame to chart-ready candle and volume lists."""
    if intraday:
        times = (df.index.astype("int64") // 10**9).tolist()
    else:
        times = df.index.strftime("%Y-%m-%d").tolist()

    opens = df["Open"].tolist()
    highs = df["High"].tolist()
    lows = df["Low"].tolist()
    closes = df["Close"].tolist()
    volumes = df["Volume"].tolist()

    candles = [
        {"time": t, "open": o, "high": h, "low": l, "close": c}
        for t, o, h, l, c in zip(times, opens, highs, lows, closes)
    ]
    volume = [
        {"time": t, "value": v, "color": "#26a69a80" if c >= o else "#ef535080"}
        for t, o, c, v in zip(times, opens, closes, volumes)
    ]
    return {"candles": candles, "volume": volume, "intraday": intraday}


def fetch_all_intervals(symbol: str) -> dict:
    """Fetch data for all configured intervals and return chart-ready datasets."""
    t_start = time.perf_counter()
    datasets = {}

    # Group interval keys by their yf_interval to deduplicate cache reads
    yf_groups: dict[str, list[tuple[str, dict]]] = {}
    for key, cfg in INTERVALS.items():
        yf_int = cfg["yf_interval"]
        yf_groups.setdefault(yf_int, []).append((key, cfg))

    def _fetch_group(yf_interval: str, members: list[tuple[str, dict]]) -> list[tuple[str, dict]]:
        """Fetch once from cache/yfinance, then produce chart data for all intervals sharing this yf_interval."""
        # Use the first member's period (the longest) for fetching
        # Find the member with the broadest period for yfinance fetch
        period = members[0][1]["period"]
        for _, cfg in members:
            if cfg["period"] == "max":
                period = "max"
                break

        # Fetch from yfinance if needed (only once per yf_interval)
        if db.should_fetch(symbol, yf_interval):
            ticker = yf.Ticker(symbol)
            new_df = ticker.history(period=period, interval=yf_interval)
            if not new_df.empty:
                db.save_data(symbol, yf_interval, new_df)

        # Single cache read for this yf_interval
        cached_df = db.get_cached_data(symbol, yf_interval)

        results = []
        for key, cfg in members:
            try:
                if cached_df.empty:
                    results.append((key, {"candles": [], "volume": [], "intraday": cfg["intraday"]}))
                    continue

                df = cached_df
                if cfg.get("resample_rule"):
                    df = _resample(df, cfg["resample_rule"])

                results.append((key, prepare_chart_data(df, cfg["intraday"])))
            except Exception as e:
                print(f"Error processing {key}: {e}")
                results.append((key, {"candles": [], "volume": [], "intraday": cfg["intraday"]}))
        return results

    # Run each yf_interval group in parallel
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = {
            executor.submit(_fetch_group, yf_int, members): yf_int
            for yf_int, members in yf_groups.items()
        }
        for future in concurrent.futures.as_completed(futures):
            for key, data in future.result():
                datasets[key] = data

    print(f"fetch_all_intervals({symbol}): {time.perf_counter()-t_start:.3f}s")
    return datasets


def get_interval_buttons() -> list:
    """Return a list of {key, label} for building UI buttons."""
    return [{"key": k, "label": v["label"]} for k, v in INTERVALS.items()]


# ---- Custom interval support ----

# Maps user-facing units to (pandas_freq_suffix, is_intraday, best_source_yf_interval, source_period)
_UNIT_CONFIG = {
    "min":    ("min",  True,  [("1m", "7d"), ("5m", "60d"), ("15m", "60d"), ("30m", "60d"), ("1h", "730d")]),
    "hours":  ("h",    True,  [("1h", "730d")]),
    "days":   ("D",    False, [("1d", "max")]),
    "weeks":  ("W",    False, [("1d", "max")]),
    "months": ("MS",   False, [("1mo", "max")]),
}


def fetch_custom_interval(symbol: str, value: int, unit: str) -> dict:
    """Fetch data for a custom interval specified by value + unit.

    Returns chart-ready dict with candles, volume, intraday fields.
    Raises ValueError if the unit is invalid or value < 1.
    """
    if value < 1:
        raise ValueError("Interval value must be >= 1")
    if unit not in _UNIT_CONFIG:
        raise ValueError(f"Invalid unit '{unit}'. Must be one of: {', '.join(_UNIT_CONFIG.keys())}")

    freq_suffix, intraday, sources = _UNIT_CONFIG[unit]
    resample_rule = f"{value}{freq_suffix}"

    # Pick the best (smallest) source interval whose period covers enough data
    # For minutes, we want the smallest source that divides evenly if possible
    yf_interval = sources[-1][0]
    period = sources[-1][1]

    if unit == "min":
        # Choose the largest source interval that divides evenly into the target
        # to minimize data volume, but fall back to 1m if needed
        source_minutes = {"1m": 1, "5m": 5, "15m": 15, "30m": 30, "1h": 60}
        for src_interval, src_period in sources:
            src_min = source_minutes[src_interval]
            if value >= src_min and value % src_min == 0:
                yf_interval = src_interval
                period = src_period
                break
        else:
            # No even divisor found, use 1m as fallback
            yf_interval = "1m"
            period = "7d"

    if db.should_fetch(symbol, yf_interval):
        ticker = yf.Ticker(symbol)
        new_df = ticker.history(period=period, interval=yf_interval)
        if not new_df.empty:
            db.save_data(symbol, yf_interval, new_df)
            
    df = db.get_cached_data(symbol, yf_interval)

    if df.empty:
        return {"candles": [], "volume": [], "intraday": intraday}

    # Resample (always, since it's a custom interval)
    df = df.resample(resample_rule).agg({
        "Open": "first",
        "High": "max",
        "Low": "min",
        "Close": "last",
        "Volume": "sum",
    }).dropna()

    if df.empty:
        return {"candles": [], "volume": [], "intraday": intraday}

    return prepare_chart_data(df, intraday)

