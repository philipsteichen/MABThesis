import os
import pandas as pd
import httpx
import yfinance as yf

BARCHART_API_KEY = os.environ.get("BARCHART_API_KEY")
BARCHART_BASE = "https://ondemand.websol.barchart.com"

# Common agricultural futures — Yahoo Finance symbols
YAHOO_COMMODITIES = {
    "Corn": "ZC=F",
    "CBOT Wheat": "ZW=F",
    "KC Wheat": "KE=F",
    "Soybeans": "ZS=F",
    "Soybean Meal": "ZM=F",
    "Soybean Oil": "ZL=F",
    "Live Cattle": "LE=F",
    "Feeder Cattle": "GF=F",
    "Lean Hogs": "HE=F",
    "Cotton": "CT=F",
    "Sugar": "SB=F",
    "Rice": "ZR=F",
}

# Common Barchart continuous contract symbols
BARCHART_COMMODITIES = {
    "Corn": "ZCY00",
    "CBOT Wheat": "ZWY00",
    "KC Wheat": "KEY00",
    "Soybeans": "ZSY00",
    "Soybean Meal": "ZMY00",
    "Soybean Oil": "ZLY00",
    "Live Cattle": "LEY00",
    "Feeder Cattle": "GFY00",
    "Lean Hogs": "HEY00",
    "Cotton": "CTY00",
    "Sugar": "SBY00",
    "Rice": "ZRY00",
}


def fetch_yahoo(symbol: str, start_date: str = "2000-01-01") -> pd.DataFrame:
    """Fetch historical daily prices from Yahoo Finance."""
    data = yf.download(symbol, start=start_date, progress=False)
    data = data.reset_index()

    # Flatten multi-level columns (yfinance >= 0.2.x returns MultiIndex)
    if isinstance(data.columns, pd.MultiIndex):
        data.columns = [col[0] for col in data.columns]

    data = data.rename(columns={"Date": "date", "Close": "price"})
    data["date"] = pd.to_datetime(data["date"]).dt.strftime("%Y-%m-%d")
    result = data[["date", "price"]].dropna()
    result["price"] = result["price"].round(4)
    return result


def fetch_barchart(symbol: str, start_date: str = "20000101") -> pd.DataFrame:
    """Fetch historical daily prices from Barchart onDemand API."""
    if not BARCHART_API_KEY:
        raise ValueError(
            "Barchart API key not configured. Set BARCHART_API_KEY environment variable."
        )

    url = f"{BARCHART_BASE}/getHistory.json"
    params = {
        "apikey": BARCHART_API_KEY,
        "symbol": symbol,
        "type": "daily",
        "startDate": start_date,
        "maxRecords": 10000,
        "order": "asc",
    }

    resp = httpx.get(url, params=params, timeout=30.0)
    resp.raise_for_status()
    body = resp.json()

    status = body.get("status", {})
    if status.get("code") != 200:
        raise ValueError(f"Barchart API error: {status.get('message', 'Unknown error')}")

    records = body.get("results", [])
    if not records:
        raise ValueError(f"No data returned for symbol '{symbol}'")

    df = pd.DataFrame(records)
    df = df.rename(columns={"tradingDay": "date", "close": "price"})
    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    return df[["date", "price"]].dropna()


def parse_uploaded_csv(content: bytes) -> pd.DataFrame:
    """Parse an uploaded CSV file. Expects 'Date' and 'Price' columns.

    Security: only reads date and price columns as strings/numbers.
    No formula evaluation, no code execution. Column count capped at 50
    and row count at 100k to prevent resource exhaustion.
    """
    import io

    MAX_ROWS = 100_000
    MAX_COLS = 50

    # Sniff first bytes – reject if it looks like a binary/zip/xlsx
    if content[:4] in (b"PK\x03\x04", b"\x00\x00", b"\xd0\xcf\x11\xe0"):
        raise ValueError("File does not appear to be a valid CSV (binary content detected)")

    df = pd.read_csv(io.BytesIO(content), nrows=MAX_ROWS)
    if len(df.columns) > MAX_COLS:
        raise ValueError(f"CSV has too many columns ({len(df.columns)}). Maximum is {MAX_COLS}.")

    # Normalize column names (case-insensitive matching)
    col_map = {}
    for col in df.columns:
        lower = col.strip().lower()
        if lower in ("date", "ds", "time", "datetime"):
            col_map[col] = "date"
        elif lower in ("price", "close", "last", "y", "value", "adjcashprice"):
            col_map[col] = "price"

    if "date" not in col_map.values() or "price" not in col_map.values():
        raise ValueError(
            f"CSV must contain a date column and a price column. "
            f"Found columns: {list(df.columns)}"
        )

    df = df.rename(columns=col_map)
    df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.strftime("%Y-%m-%d")
    df["price"] = pd.to_numeric(df["price"], errors="coerce")
    df = df[["date", "price"]].dropna()
    df = df.sort_values("date").reset_index(drop=True)
    return df


def get_available_sources() -> list[dict]:
    """Return available data sources and their commodities."""
    sources = [
        {
            "id": "yahoo",
            "name": "Yahoo Finance",
            "available": True,
            "commodities": list(YAHOO_COMMODITIES.keys()),
        },
        {
            "id": "barchart",
            "name": "Barchart API",
            "available": BARCHART_API_KEY is not None,
            "commodities": list(BARCHART_COMMODITIES.keys()),
        },
        {
            "id": "upload",
            "name": "Upload CSV",
            "available": True,
            "commodities": [],
        },
    ]
    return sources
