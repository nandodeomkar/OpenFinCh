"""SEC EDGAR 13F data download, parsing, and caching.

Downloads quarterly bulk 13F datasets from SEC EDGAR, parses INFOTABLE.tsv
and COVERPAGE.tsv to find all institutional holders for a given CUSIP.
"""

import csv
import io
import os
import re
import zipfile
from pathlib import Path
from urllib.request import urlopen, Request

import yfinance as yf

SEC_BASE = "https://www.sec.gov/files/structureddata/data/form-13f-data-sets"
SEC_INDEX = "https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets"
USER_AGENT = "OpenFinCh admin@openfinch.app"
DATA_DIR = Path.home() / ".openfinch" / "13f"

# In-memory caches
_cusip_cache: dict[str, str] = {}
_holders_cache: dict[str, dict] = {}
_latest_url_cache: str | None = None


def _sec_request(url: str) -> bytes:
    """Make a request to SEC with the required User-Agent header."""
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req, timeout=120) as resp:
        return resp.read()


def get_latest_13f_url() -> str:
    """Scrape SEC index page to find the most recent 13F ZIP URL."""
    global _latest_url_cache
    if _latest_url_cache:
        return _latest_url_cache

    html = _sec_request(SEC_INDEX).decode("utf-8", errors="replace")
    # Look for ZIP links in the page
    pattern = r'href="([^"]*form13f[^"]*\.zip)"'
    matches = re.findall(pattern, html, re.IGNORECASE)
    if not matches:
        # Try alternate pattern for full URLs
        pattern = r'(https?://[^"]*form13f[^"]*\.zip)'
        matches = re.findall(pattern, html, re.IGNORECASE)

    if not matches:
        raise RuntimeError("Could not find 13F ZIP URL on SEC index page")

    # Take the first match (most recent quarter — page lists newest first)
    url = matches[0]
    if url.startswith("/"):
        url = "https://www.sec.gov" + url
    elif not url.startswith("http"):
        url = SEC_BASE + "/" + url

    _latest_url_cache = url
    return url


def ensure_13f_data() -> Path:
    """Download and extract 13F data if not already cached.

    Returns path to directory containing INFOTABLE.tsv and COVERPAGE.tsv.
    """
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    url = get_latest_13f_url()
    # Derive a folder name from the ZIP filename
    zip_name = url.rsplit("/", 1)[-1]
    quarter_dir = DATA_DIR / zip_name.replace(".zip", "")

    info_path = quarter_dir / "INFOTABLE.tsv"
    cover_path = quarter_dir / "COVERPAGE.tsv"

    if info_path.exists() and cover_path.exists():
        return quarter_dir

    print(f"[OpenFinCh] Downloading 13F data from SEC EDGAR...")
    print(f"[OpenFinCh] URL: {url}")
    print(f"[OpenFinCh] This is a one-time download (~100MB). Please wait...")

    data = _sec_request(url)

    quarter_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        for name in zf.namelist():
            base = name.rsplit("/", 1)[-1].upper()
            if base in ("INFOTABLE.TSV", "COVERPAGE.TSV"):
                content = zf.read(name)
                out_path = quarter_dir / base
                out_path.write_bytes(content)
                print(f"[OpenFinCh] Extracted {base} ({len(content) / 1e6:.1f} MB)")

    if not info_path.exists():
        raise RuntimeError("INFOTABLE.tsv not found in ZIP archive")
    if not cover_path.exists():
        raise RuntimeError("COVERPAGE.tsv not found in ZIP archive")

    print("[OpenFinCh] 13F data ready.")
    return quarter_dir


def _search_cusip_in_infotable(company_name: str, data_dir: Path) -> str | None:
    """Search INFOTABLE.tsv for a CUSIP by matching company name."""
    info_path = data_dir / "INFOTABLE.tsv"
    if not info_path.exists():
        return None

    # Build search terms from the company name
    # e.g. "Tesla, Inc." -> "TESLA", "Alphabet Inc." -> "ALPHABET"
    clean = re.sub(r"[,.\-\s]+(inc|corp|co|ltd|plc|llc|lp)\.?\s*$", "",
                   company_name, flags=re.IGNORECASE).strip()
    search_term = clean.upper()
    if not search_term:
        return None

    # Count occurrences of each CUSIP prefix matching our search term
    cusip_counts: dict[str, int] = {}
    with open(info_path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            issuer = (row.get("NAMEOFISSUER") or "").upper()
            if search_term in issuer:
                cusip = (row.get("CUSIP") or "").strip()
                if len(cusip) >= 6:
                    prefix = cusip[:6]
                    cusip_counts[prefix] = cusip_counts.get(prefix, 0) + 1

    if cusip_counts:
        # Return the most common CUSIP prefix (handles multiple share classes)
        return max(cusip_counts, key=cusip_counts.get)
    return None


def get_cusip(symbol: str) -> str:
    """Get the 6-character CUSIP prefix for a stock symbol."""
    symbol = symbol.upper()
    if symbol in _cusip_cache:
        return _cusip_cache[symbol]

    ticker = yf.Ticker(symbol)

    # Method 1: ISIN lookup
    try:
        isin = ticker.get_isin()
        if isin and len(isin) >= 11 and isin.startswith("US"):
            cusip6 = isin[2:8]
            _cusip_cache[symbol] = cusip6
            return cusip6
    except Exception:
        pass

    # Method 2: Search INFOTABLE by company name
    try:
        info = ticker.get_info() or {}
        company_name = info.get("shortName") or info.get("longName") or ""
        if company_name:
            data_dir = ensure_13f_data()
            cusip6 = _search_cusip_in_infotable(company_name, data_dir)
            if cusip6:
                _cusip_cache[symbol] = cusip6
                return cusip6
    except Exception:
        pass

    raise ValueError(
        f"Could not determine CUSIP for {symbol}. "
        "SEC 13F data is only available for US-listed securities."
    )


def lookup_holders(cusip6: str, data_dir: Path) -> list[dict]:
    """Find all institutional holders for a CUSIP by streaming 13F TSV files.

    Args:
        cusip6: 6-character CUSIP prefix
        data_dir: Path to directory with INFOTABLE.tsv and COVERPAGE.tsv

    Returns:
        List of holder dicts sorted by shares descending
    """
    if cusip6 in _holders_cache:
        return _holders_cache[cusip6]

    info_path = data_dir / "INFOTABLE.tsv"
    cover_path = data_dir / "COVERPAGE.tsv"

    # Step 1: Stream INFOTABLE.tsv, filter by CUSIP prefix
    # Collect accession numbers and holding data
    holdings_by_accession: dict[str, dict] = {}

    with open(info_path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            row_cusip = (row.get("CUSIP") or "").strip()
            if row_cusip[:6] == cusip6:
                accession = (row.get("ACCESSION_NUMBER") or "").strip()
                if not accession:
                    continue
                try:
                    shares = int(float(row.get("SSHPRNAMT") or row.get("SHRS_OR_PRN_AMT") or 0))
                except (ValueError, TypeError):
                    shares = 0
                try:
                    value = int(float(row.get("VALUE") or 0)) * 1000  # Value in thousands
                except (ValueError, TypeError):
                    value = 0
                sh_type = (row.get("SSHPRNAMTTYPE") or row.get("PUT_CALL") or "SH").strip()

                # Aggregate if same accession has multiple entries for same CUSIP
                if accession in holdings_by_accession:
                    holdings_by_accession[accession]["shares"] += shares
                    holdings_by_accession[accession]["value"] += value
                else:
                    holdings_by_accession[accession] = {
                        "shares": shares,
                        "value": value,
                        "type": sh_type,
                    }

    if not holdings_by_accession:
        _holders_cache[cusip6] = []
        return []

    # Step 2: Batch lookup filer names from COVERPAGE.tsv
    accession_set = set(holdings_by_accession.keys())
    filer_names: dict[str, tuple[str, str]] = {}  # accession -> (name, filing_date)

    with open(cover_path, "r", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f, delimiter="\t")
        for row in reader:
            accession = (row.get("ACCESSION_NUMBER") or "").strip()
            if accession in accession_set:
                name = (row.get("FILINGMANAGER_NAME") or row.get("FILING_MANAGER") or "").strip()
                date = (row.get("REPORTCALENDARORQUARTER") or row.get("PERIODOFREPORT") or "").strip()
                if name:
                    filer_names[accession] = (name, date)

    # Step 3: Build results
    results = []
    for accession, holding in holdings_by_accession.items():
        name, date = filer_names.get(accession, ("Unknown Filer", ""))
        results.append({
            "holder": name,
            "shares": holding["shares"],
            "value": holding["value"],
            "type": holding["type"],
            "filingDate": date,
        })

    # Sort by shares descending
    results.sort(key=lambda x: x["shares"], reverse=True)

    _holders_cache[cusip6] = results
    return results


def get_holders(symbol: str) -> dict:
    """Main entry point: get all 13F institutional holders for a symbol.

    Returns dict with holders list, quarter info, and total count.
    """
    cusip6 = get_cusip(symbol)
    data_dir = ensure_13f_data()
    holders = lookup_holders(cusip6, data_dir)

    # Derive quarter from the data directory name
    quarter = data_dir.name  # e.g. "01sep2025-30nov2025_form13f"

    return {
        "holders": holders,
        "quarter": quarter,
        "total": len(holders),
        "cusip": cusip6,
    }
