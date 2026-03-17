import pandas as pd
from app.config import FUTURES_PATH, CASH_PATH, CASH_SHEET

_cash_cache: pd.DataFrame | None = None
_futures_cache: pd.DataFrame | None = None


def get_cash_prices() -> pd.DataFrame:
    global _cash_cache
    if _cash_cache is None:
        df = pd.read_excel(CASH_PATH, sheet_name=CASH_SHEET)
        df["Date"] = pd.to_datetime(df["Date"])
        df = df.sort_values("Date").reset_index(drop=True)
        _cash_cache = df
    return _cash_cache.copy()


def get_futures_prices() -> pd.DataFrame:
    global _futures_cache
    if _futures_cache is None:
        df = pd.read_csv(FUTURES_PATH)
        df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
        df = df.dropna(subset=["Date"])
        # Convert cents/bu to $/bu
        for col in ["Open", "High", "Low", "Last"]:
            df[col] = df[col] / 100.0
        df = df.sort_values("Date").reset_index(drop=True)
        _futures_cache = df
    return _futures_cache.copy()


def get_available_locations() -> list[str]:
    df = get_cash_prices()
    return sorted(df["location"].unique().tolist())


def get_available_crops() -> list[str]:
    df = get_cash_prices()
    return sorted(df["CropName"].unique().tolist())
