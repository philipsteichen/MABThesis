import pandas as pd
import numpy as np
from app.services.data_loader import get_cash_prices, get_futures_prices


def get_nearby_futures() -> pd.DataFrame:
    """For each date, get the nearby (front-month) contract price."""
    df = get_futures_prices()

    # contract_month is already numeric (3=Mar, 5=May, 7=Jul, 9=Sep, 12=Dec)
    # Create contract expiry date (1st of the contract month)
    df["contract_expiry"] = pd.to_datetime(
        df["contract_year"].astype(int).astype(str)
        + "-"
        + df["contract_month"].astype(int).astype(str).str.zfill(2)
        + "-01"
    )

    # Days to expiry (positive = hasn't expired yet)
    df["days_to_expiry"] = (df["contract_expiry"] - df["Date"]).dt.days

    # Keep only contracts that haven't expired
    df = df[df["days_to_expiry"] > 0].copy()

    # For each date, pick the contract with smallest days_to_expiry (nearby)
    idx = df.groupby("Date")["days_to_expiry"].idxmin()
    nearby = df.loc[idx].copy()

    return nearby[
        ["Date", "Last", "Futures_Contract_Type", "contract_expiry", "days_to_expiry"]
    ].rename(columns={"Last": "futures_price"})


def _roll_adjust_futures(nearby: pd.DataFrame) -> pd.DataFrame:
    """Adjust futures prices to remove discontinuities at contract rolls.

    On each date where the nearby contract changes, compute the price gap
    between the new and old contracts.  A cumulative adjustment is subtracted
    from all subsequent futures prices so that the series is continuous.
    """
    df = nearby.sort_values("Date").copy()
    df["prev_contract"] = df["Futures_Contract_Type"].shift(1)
    df["is_roll_date"] = df["Futures_Contract_Type"] != df["prev_contract"]
    # First row is never a real roll
    df.loc[df.index[0], "is_roll_date"] = False

    # On roll dates the gap = new price - old price (previous row's price)
    df["prev_price"] = df["futures_price"].shift(1)
    df["roll_gap"] = np.where(
        df["is_roll_date"],
        df["futures_price"] - df["prev_price"],
        0.0,
    )
    df["cum_roll_adj"] = df["roll_gap"].cumsum()
    df["futures_price_adj"] = df["futures_price"] - df["cum_roll_adj"]

    df.drop(columns=["prev_contract", "prev_price", "roll_gap"], inplace=True)
    return df


def calculate_basis(
    location: str | None = None,
    crop: str = "HRW",
    start_date: str | None = None,
    end_date: str | None = None,
    adjust_rolls: bool = True,
) -> pd.DataFrame:
    """Calculate basis = cash price - nearby futures price.

    When *adjust_rolls* is True the futures series is roll-adjusted so that
    contract switches do not create artificial basis spikes.
    """
    cash = get_cash_prices()

    # Filter by crop
    cash = cash[cash["CropName"] == crop]

    # Filter by location
    if location:
        cash = cash[cash["location"] == location]

    # Get nearby futures
    nearby = get_nearby_futures()

    if adjust_rolls:
        nearby = _roll_adjust_futures(nearby)

    # Merge on date
    basis_df = cash.merge(nearby, on="Date", how="inner")

    # Calculate basis (both in $/bu after conversion)
    if adjust_rolls and "futures_price_adj" in basis_df.columns:
        basis_df["basis"] = basis_df["AdjCashPrice"] - basis_df["futures_price_adj"]
    else:
        basis_df["basis"] = basis_df["AdjCashPrice"] - basis_df["futures_price"]

    # Date filters
    if start_date:
        basis_df = basis_df[basis_df["Date"] >= pd.to_datetime(start_date)]
    if end_date:
        basis_df = basis_df[basis_df["Date"] <= pd.to_datetime(end_date)]

    basis_df = basis_df.sort_values("Date")
    return basis_df


def get_basis_summary(
    location: str | None = None, crop: str = "HRW", adjust_rolls: bool = True
) -> dict:
    """Get summary statistics for basis."""
    basis_df = calculate_basis(location=location, crop=crop, adjust_rolls=adjust_rolls)

    if basis_df.empty:
        return {
            "location": location or "ALL",
            "crop": crop,
            "current_basis": None,
            "avg_basis": 0,
            "min_basis": 0,
            "max_basis": 0,
            "std_basis": 0,
            "data_points": 0,
        }

    return {
        "location": location or "ALL",
        "crop": crop,
        "current_basis": round(float(basis_df.iloc[-1]["basis"]), 4),
        "avg_basis": round(float(basis_df["basis"].mean()), 4),
        "min_basis": round(float(basis_df["basis"].min()), 4),
        "max_basis": round(float(basis_df["basis"].max()), 4),
        "std_basis": round(float(basis_df["basis"].std()), 4),
        "data_points": len(basis_df),
    }


def get_seasonal_basis(
    location: str | None = None, crop: str = "HRW", adjust_rolls: bool = True
) -> list[dict]:
    """Get average basis by month."""
    basis_df = calculate_basis(location=location, crop=crop, adjust_rolls=adjust_rolls)

    if basis_df.empty:
        return []

    basis_df["month"] = basis_df["Date"].dt.month

    seasonal = (
        basis_df.groupby("month")["basis"]
        .agg(["mean", "min", "max", "std", "count"])
        .reset_index()
    )
    seasonal.columns = ["month", "avg_basis", "min_basis", "max_basis", "std_basis", "count"]

    # Round values
    for col in ["avg_basis", "min_basis", "max_basis", "std_basis"]:
        seasonal[col] = seasonal[col].round(4)

    return seasonal.to_dict(orient="records")


def get_basis_by_year(
    location: str | None = None, crop: str = "HRW", adjust_rolls: bool = True
) -> list[dict]:
    """Get basis data grouped by crop year for year-over-year comparison."""
    basis_df = calculate_basis(location=location, crop=crop, adjust_rolls=adjust_rolls)

    if basis_df.empty:
        return []

    basis_df["year"] = basis_df["Date"].dt.year
    basis_df["week"] = basis_df["Date"].dt.isocalendar().week.astype(int)

    result = []
    for _, row in basis_df.iterrows():
        result.append(
            {
                "date": row["Date"].strftime("%Y-%m-%d"),
                "year": int(row["year"]),
                "week": int(row["week"]),
                "basis": round(float(row["basis"]), 4),
                "location": row["location"],
            }
        )

    return result
