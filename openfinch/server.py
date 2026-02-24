"""Local HTTP server for OpenFinCh running on FastAPI.

Serves the chart page and provides a JSON API for fetching stock data.
"""

import importlib
import math
import threading
import webbrowser
from urllib.request import urlopen, Request
from urllib.parse import quote
from email.utils import parsedate_to_datetime
import xml.etree.ElementTree as ET

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

import yfinance as yf

from openfinch.edgar import get_holders
from openfinch.intervals import fetch_all_intervals, fetch_custom_interval
import openfinch.stock_chart as _stock_chart_mod

DEFAULT_SYMBOL = "AAPL"
PORT = 8765

app = FastAPI(title="OpenFinCh API")

class SymbolRequest(BaseModel):
    symbol: str

class CustomIntervalRequest(BaseModel):
    symbol: str
    value: int
    unit: str

class NewsRequest(BaseModel):
    symbol: str
    start: int = 0

class FinancialsRequest(BaseModel):
    symbol: str
    freq: str = "annual"

class SearchRequest(BaseModel):
    query: str

@app.get("/", response_class=HTMLResponse)
def get_chart():
    importlib.reload(_stock_chart_mod)
    html = _stock_chart_mod.build_chart_html(DEFAULT_SYMBOL)
    return html

@app.post("/api/data")
def api_data(req: SymbolRequest):
    symbol = req.symbol.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Missing symbol")

    try:
        datasets = fetch_all_intervals(symbol)
        has_data = any(len(ds["candles"]) > 0 for ds in datasets.values())
        if not has_data:
            raise HTTPException(status_code=404, detail=f"No data found for '{symbol}'")
        return {"symbol": symbol, "datasets": datasets}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/custom_interval")
def api_custom_interval(req: CustomIntervalRequest):
    symbol = req.symbol.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Missing symbol")

    try:
        dataset = fetch_custom_interval(symbol, req.value, req.unit.strip().lower())
        if not dataset["candles"]:
            raise HTTPException(status_code=404, detail=f"No data for '{symbol}' at {req.value} {req.unit}")
        return {"dataset": dataset}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/news")
def api_news(req: NewsRequest):
    symbol = req.symbol.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Missing symbol")
    start = req.start
    page_size = 15

    try:
        rss_url = (
            f"https://news.google.com/rss/search"
            f'?q="{quote(symbol)}"+stock+market&hl=en&gl=US&ceid=US:en'
        )
        rss_req = Request(rss_url, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(rss_req, timeout=5) as resp:
            xml_data = resp.read()

        root = ET.fromstring(xml_data)
        items = root.findall(".//item")

        articles = []
        for item in items:
            pub = item.findtext("pubDate") or ""
            try:
                dt = parsedate_to_datetime(pub)
            except Exception:
                dt = None
            source_el = item.find("source")
            articles.append({
                "title": (item.findtext("title") or "").strip(),
                "summary": "",
                "pubDate": pub,
                "url": (item.findtext("link") or "").strip(),
                "source": source_el.text if source_el is not None and source_el.text else "",
                "thumbnail": "",
                "_dt": dt,
            })

        articles.sort(
            key=lambda a: a["_dt"] or parsedate_to_datetime("1 Jan 1970 00:00:00 GMT"),
            reverse=True,
        )
        for a in articles:
            del a["_dt"]

        page = articles[start:start + page_size]
        has_more = start + page_size < len(articles)

        return {"news": page, "hasMore": has_more}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/insiders")
def api_insiders(req: SymbolRequest):
    symbol = req.symbol.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Missing symbol")

    try:
        ticker = yf.Ticker(symbol)
        df = ticker.insider_transactions
        insiders = []
        if df is not None and not df.empty:
            for _, row in df.iterrows():
                val = row.get("Value", None)
                if val is not None:
                    try:
                        if math.isnan(val):
                            val = None
                    except (TypeError, ValueError):
                        pass
                shares = row.get("Shares", None)
                if shares is not None:
                    try:
                        if math.isnan(shares):
                            shares = None
                        else:
                            shares = int(shares)
                    except (TypeError, ValueError):
                        pass
                start_date = row.get("Start Date", None)
                if start_date is not None:
                    start_date = str(start_date)
                txn = str(row.get("Transaction", "")).strip()
                if not txn:
                    text = str(row.get("Text", "")).lower()
                    if "sale" in text:
                        txn = "Sale"
                    elif "purchase" in text or "buy" in text:
                        txn = "Purchase"
                    elif "gift" in text:
                        txn = "Stock Gift"
                    elif "exercise" in text:
                        txn = "Option Exercise"
                    elif val is not None and val > 0 and shares and shares > 0:
                        txn = "Sale"
                    elif val is None or val == 0:
                        txn = "Award"
                insiders.append({
                    "insider": str(row.get("Insider", "")),
                    "position": str(row.get("Position", "")),
                    "transaction": txn,
                    "date": start_date or "",
                    "shares": shares,
                    "value": val,
                    "ownership": str(row.get("Ownership", "")),
                })
        return {"insiders": insiders}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/profile")
def api_profile(req: SymbolRequest):
    symbol = req.symbol.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Missing symbol")

    try:
        ticker = yf.Ticker(symbol)
        info = ticker.get_info() or {}

        summary = info.get("longBusinessSummary", "")
        if summary and len(summary) > 500:
            summary = summary[:500] + "..."

        cal = {}
        try:
            cal_raw = ticker.get_calendar()
            if cal_raw is not None:
                if isinstance(cal_raw, dict):
                    cal = cal_raw
        except Exception:
            pass

        fields = [
            "shortName", "longName", "symbol", "exchange",
            "quoteType", "sector", "industry", "country", "city",
            "website", "marketCap", "enterpriseValue",
            "trailingPE", "forwardPE", "pegRatio", "priceToBook",
            "profitMargins", "operatingMargins", "grossMargins",
            "returnOnEquity", "returnOnAssets",
            "revenueGrowth", "earningsGrowth",
            "dividendYield", "dividendRate", "payoutRatio",
            "beta", "fiftyTwoWeekHigh", "fiftyTwoWeekLow",
            "fiftyDayAverage", "twoHundredDayAverage",
            "averageVolume", "averageVolume10days",
            "fullTimeEmployees", "currentPrice",
            "targetHighPrice", "targetLowPrice",
            "targetMeanPrice", "targetMedianPrice",
            "recommendationKey",
        ]
        profile = {}
        for f in fields:
            v = info.get(f)
            if v is not None:
                try:
                    if isinstance(v, float) and math.isnan(v):
                        v = None
                except (TypeError, ValueError):
                    pass
            profile[f] = v

        profile["longBusinessSummary"] = summary

        cal_clean = {}
        for k, v in cal.items():
            if v is not None:
                if isinstance(v, list):
                    cal_clean[k] = [str(x) for x in v]
                else:
                    try:
                        if isinstance(v, float) and math.isnan(v):
                            v = None
                    except (TypeError, ValueError):
                        pass
                    cal_clean[k] = str(v) if v is not None else None
        profile["calendar"] = cal_clean

        return {"profile": profile}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analysts")
def api_analysts(req: SymbolRequest):
    symbol = req.symbol.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Missing symbol")

    try:
        ticker = yf.Ticker(symbol)
        result = {}

        try:
            pt = ticker.get_analyst_price_targets()
            if pt is not None and isinstance(pt, dict):
                result["priceTargets"] = {
                    k: (None if (isinstance(v, float) and math.isnan(v)) else v)
                    for k, v in pt.items()
                }
            else:
                result["priceTargets"] = None
        except Exception:
            result["priceTargets"] = None

        try:
            rec = ticker.get_recommendations()
            if rec is not None and not rec.empty:
                latest = rec.iloc[0].to_dict()
                result["recommendations"] = {
                    k: (None if (isinstance(v, float) and math.isnan(v)) else v)
                    for k, v in latest.items()
                }
            else:
                result["recommendations"] = None
        except Exception:
            result["recommendations"] = None

        try:
            ud = ticker.get_upgrades_downgrades()
            if ud is not None and not ud.empty:
                rows = []
                for idx, row in ud.head(20).iterrows():
                    rows.append({
                        "date": str(idx),
                        "firm": str(row.get("Firm", "")),
                        "toGrade": str(row.get("ToGrade", "")),
                        "fromGrade": str(row.get("FromGrade", "")),
                        "action": str(row.get("Action", "")),
                    })
                result["upgrades"] = rows
            else:
                result["upgrades"] = []
        except Exception:
            result["upgrades"] = []

        try:
            ih = ticker.get_institutional_holders()
            if ih is not None and not ih.empty:
                holders = []
                for _, row in ih.iterrows():
                    entry = {}
                    for col in ih.columns:
                        v = row.get(col)
                        if v is not None:
                            try:
                                if isinstance(v, float) and math.isnan(v):
                                    v = None
                            except (TypeError, ValueError):
                                pass
                        entry[col] = str(v) if v is not None else None
                    holders.append(entry)
                result["institutional"] = holders
            else:
                result["institutional"] = []
        except Exception:
            result["institutional"] = []

        try:
            mf = ticker.get_mutualfund_holders()
            if mf is not None and not mf.empty:
                holders = []
                for _, row in mf.iterrows():
                    entry = {}
                    for col in mf.columns:
                        v = row.get(col)
                        if v is not None:
                            try:
                                if isinstance(v, float) and math.isnan(v):
                                    v = None
                            except (TypeError, ValueError):
                                pass
                        entry[col] = str(v) if v is not None else None
                    holders.append(entry)
                result["mutualFund"] = holders
            else:
                result["mutualFund"] = []
        except Exception:
            result["mutualFund"] = []

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/financials")
def api_financials(req: FinancialsRequest):
    symbol = req.symbol.strip().upper()
    freq = req.freq.strip().lower()
    if not symbol:
        raise HTTPException(status_code=400, detail="Missing symbol")
    if freq not in ("annual", "quarterly"):
        freq = "annual"

    try:
        ticker = yf.Ticker(symbol)
        result = {"freq": freq}

        def df_to_dict(df):
            if df is None or df.empty:
                return None
            out = {}
            for col in df.columns:
                col_key = str(col)
                if hasattr(col, 'strftime'):
                    col_key = col.strftime('%Y-%m-%d')
                col_data = {}
                for idx, val in df[col].items():
                    v = val
                    if v is not None:
                        try:
                            if isinstance(v, float) and math.isnan(v):
                                v = None
                        except (TypeError, ValueError):
                            pass
                    col_data[str(idx)] = v
                out[col_key] = col_data
            return out

        try:
            inc = ticker.get_financials(freq=freq)
            result["income"] = df_to_dict(inc)
        except Exception:
            result["income"] = None

        try:
            bs = ticker.get_balance_sheet(freq=freq)
            result["balance"] = df_to_dict(bs)
        except Exception:
            result["balance"] = None

        try:
            cf = ticker.get_cash_flow(freq=freq)
            result["cashflow"] = df_to_dict(cf)
        except Exception:
            result["cashflow"] = None

        try:
            ed = ticker.get_earnings_dates(limit=12)
            if ed is not None and not ed.empty:
                dates = []
                for idx, row in ed.iterrows():
                    entry = {"date": str(idx)}
                    for col in ed.columns:
                        v = row.get(col)
                        if v is not None:
                            try:
                                if isinstance(v, float) and math.isnan(v):
                                    v = None
                            except (TypeError, ValueError):
                                pass
                        entry[col] = v
                    dates.append(entry)
                result["earningsDates"] = dates
            else:
                result["earningsDates"] = []
        except Exception:
            result["earningsDates"] = []

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/holders")
def api_holders(req: SymbolRequest):
    symbol = req.symbol.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Missing symbol")

    try:
        result = get_holders(symbol)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/search")
def api_search(req: SearchRequest):
    query = req.query.strip()
    if not query:
        return {"results": []}

    try:
        import json
        url = (
            f"https://query2.finance.yahoo.com/v1/finance/search"
            f"?q={quote(query)}&quotesCount=6&newsCount=0"
            f"&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query"
        )
        yahoo_req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urlopen(yahoo_req, timeout=5) as resp:
            raw = json.loads(resp.read().decode("utf-8"))

        results = []
        for q in raw.get("quotes", []):
            results.append({
                "symbol": q.get("symbol", ""),
                "name": q.get("shortname") or q.get("longname", ""),
                "exchange": q.get("exchDisp", ""),
                "type": q.get("quoteType", ""),
            })

        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def start_server():
    """Start the local FastAPI server using Uvicorn and open the browser."""
    url = f"http://127.0.0.1:{PORT}"
    print(f"OpenFinCh API running at {url}")
    print("Press Ctrl+C to stop.")

    threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="info")
