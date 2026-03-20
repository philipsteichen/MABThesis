import numpy as np
import pandas as pd
from prophet import Prophet
from app.services.basis import calculate_basis


def compute_var(
    location: str | None = None,
    crop: str = "HRW",
    confidence: float = 0.95,
    window: int | None = None,
) -> dict:
    """Historical Value at Risk and Conditional VaR for weekly basis changes.

    VaR_α  = -Q_{1-α}(ΔB)
    CVaR_α = -E[ΔB | ΔB ≤ -VaR_α]
    """
    basis_df = calculate_basis(location=location, crop=crop)
    if len(basis_df) < 3:
        return {
            "var_95": None, "cvar_95": None,
            "var_99": None, "cvar_99": None,
            "observation_count": len(basis_df),
            "mean_change": None, "std_change": None,
        }

    changes = basis_df["basis"].diff().dropna().values

    if window and window < len(changes):
        changes = changes[-window:]

    def _var(data: np.ndarray, alpha: float) -> float:
        return float(-np.percentile(data, (1 - alpha) * 100))

    def _cvar(data: np.ndarray, alpha: float) -> float:
        var = _var(data, alpha)
        tail = data[data <= -var]
        return float(-tail.mean()) if len(tail) > 0 else var

    return {
        "var_95": round(_var(changes, 0.95), 4),
        "cvar_95": round(_cvar(changes, 0.95), 4),
        "var_99": round(_var(changes, 0.99), 4),
        "cvar_99": round(_cvar(changes, 0.99), 4),
        "observation_count": len(changes),
        "mean_change": round(float(np.mean(changes)), 4),
        "std_change": round(float(np.std(changes, ddof=1)), 4),
    }


def compute_rolling_volatility(
    location: str | None = None,
    crop: str = "HRW",
    windows: list[int] | None = None,
) -> list[dict]:
    """Rolling standard deviation of basis over configurable windows.

    σ_t(w) = std(B_{t-w+1}, ..., B_t)

    Default windows: 13, 26, 52 weeks (~3mo, ~6mo, ~1yr for weekly data).
    """
    if windows is None:
        windows = [13, 26, 52]

    basis_df = calculate_basis(location=location, crop=crop)
    if basis_df.empty:
        return []

    result = basis_df[["Date", "basis"]].copy()
    for w in windows:
        result[f"vol_{w}"] = result["basis"].rolling(window=w, min_periods=w).std()

    records = []
    for _, row in result.iterrows():
        rec = {
            "date": row["Date"].strftime("%Y-%m-%d"),
            "basis": round(float(row["basis"]), 4),
        }
        for w in windows:
            val = row[f"vol_{w}"]
            rec[f"vol_{w}"] = round(float(val), 4) if pd.notna(val) else None
        records.append(rec)

    return records


def compute_convergence(
    location: str | None = None,
    crop: str = "HRW",
) -> dict:
    """Analyse how basis narrows as the futures contract approaches expiry.

    Groups observations by days-to-expiry buckets and returns both
    bucket averages and individual scatter points.
    """
    basis_df = calculate_basis(location=location, crop=crop)
    if basis_df.empty:
        return {"by_bucket": [], "by_point": []}

    df = basis_df[["Date", "basis", "days_to_expiry"]].copy()

    # Define DTE buckets
    buckets = [(0, 30), (31, 60), (61, 90), (91, 120), (121, 180), (181, 999)]
    bucket_labels = ["0-30", "31-60", "61-90", "91-120", "121-180", "180+"]

    by_bucket = []
    for (lo, hi), label in zip(buckets, bucket_labels):
        mask = (df["days_to_expiry"] >= lo) & (df["days_to_expiry"] <= hi)
        subset = df.loc[mask, "basis"]
        if len(subset) > 0:
            by_bucket.append({
                "bucket": label,
                "avg_basis": round(float(subset.mean()), 4),
                "std_basis": round(float(subset.std()), 4),
                "count": int(len(subset)),
            })

    # Scatter data (cap at 2000 for frontend performance)
    scatter = df.sort_values("days_to_expiry")
    if len(scatter) > 2000:
        step = len(scatter) // 2000
        scatter = scatter.iloc[::step]

    by_point = [
        {
            "days_to_expiry": int(row["days_to_expiry"]),
            "basis": round(float(row["basis"]), 4),
            "date": row["Date"].strftime("%Y-%m-%d"),
        }
        for _, row in scatter.iterrows()
    ]

    return {"by_bucket": by_bucket, "by_point": by_point}


def compute_forecast_accuracy(
    location: str | None = None,
    crop: str = "HRW",
    test_fraction: float = 0.2,
) -> dict:
    """Train/test split evaluation of Prophet basis forecast.

    Metrics: MAE, RMSE, MAPE, 80% CI coverage.
    """
    basis_df = calculate_basis(location=location, crop=crop)
    if len(basis_df) < 20:
        return {
            "mae": None, "rmse": None, "mape": None, "coverage_80": None,
            "test_points": 0, "train_points": 0, "test_data": [],
        }

    df = basis_df[["Date", "basis"]].rename(columns={"Date": "ds", "basis": "y"})
    split = int(len(df) * (1 - test_fraction))
    train = df.iloc[:split].copy()
    test = df.iloc[split:].copy()

    m = Prophet(yearly_seasonality=True, weekly_seasonality=False, daily_seasonality=False)
    m.fit(train)

    future = m.make_future_dataframe(periods=len(test))
    forecast = m.predict(future)

    # Merge forecast with test actuals
    merged = test.merge(
        forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]],
        on="ds", how="inner",
    )

    if merged.empty:
        return {
            "mae": None, "rmse": None, "mape": None, "coverage_80": None,
            "test_points": 0, "train_points": len(train), "test_data": [],
        }

    actual = merged["y"].values
    predicted = merged["yhat"].values
    lower = merged["yhat_lower"].values
    upper = merged["yhat_upper"].values

    errors = actual - predicted
    mae = float(np.mean(np.abs(errors)))
    rmse = float(np.sqrt(np.mean(errors ** 2)))

    # MAPE (skip zero actuals)
    nonzero = actual != 0
    if nonzero.any():
        mape = float(100 * np.mean(np.abs(errors[nonzero]) / np.abs(actual[nonzero])))
    else:
        mape = None

    coverage = float(np.mean((actual >= lower) & (actual <= upper)) * 100)

    test_data = [
        {
            "date": row["ds"].strftime("%Y-%m-%d"),
            "actual": round(float(row["y"]), 4),
            "forecast": round(float(row["yhat"]), 4),
            "lower": round(float(row["yhat_lower"]), 4),
            "upper": round(float(row["yhat_upper"]), 4),
        }
        for _, row in merged.iterrows()
    ]

    return {
        "mae": round(mae, 4),
        "rmse": round(rmse, 4),
        "mape": round(mape, 2) if mape is not None else None,
        "coverage_80": round(coverage, 1),
        "test_points": len(merged),
        "train_points": len(train),
        "test_data": test_data,
    }


def compute_hedging_effectiveness(
    location: str | None = None,
    crop: str = "HRW",
    test_fraction: float = 0.2,
) -> dict:
    """Compare Prophet-informed hedging vs naive (historical avg) hedging.

    HE = 1 - Var(e_hedged) / Var(ΔB_unhedged)
    """
    basis_df = calculate_basis(location=location, crop=crop)
    if len(basis_df) < 20:
        return {
            "naive_he": None, "prophet_he": None,
            "naive_mse": None, "prophet_mse": None,
            "variance_unhedged": None, "variance_naive": None,
            "variance_prophet": None, "improvement_over_naive_pct": None,
        }

    df = basis_df[["Date", "basis"]].rename(columns={"Date": "ds", "basis": "y"})
    split = int(len(df) * (1 - test_fraction))
    train = df.iloc[:split].copy()
    test = df.iloc[split:].copy()

    # Fit Prophet on training data
    m = Prophet(yearly_seasonality=True, weekly_seasonality=False, daily_seasonality=False)
    m.fit(train)
    future = m.make_future_dataframe(periods=len(test))
    forecast = m.predict(future)

    merged = test.merge(forecast[["ds", "yhat"]], on="ds", how="inner")
    if merged.empty:
        return {
            "naive_he": None, "prophet_he": None,
            "naive_mse": None, "prophet_mse": None,
            "variance_unhedged": None, "variance_naive": None,
            "variance_prophet": None, "improvement_over_naive_pct": None,
        }

    actual = merged["y"].values
    predicted = merged["yhat"].values

    # Unhedged: variance of basis changes
    basis_changes = np.diff(actual)
    var_unhedged = float(np.var(basis_changes, ddof=1)) if len(basis_changes) > 1 else 0.0

    # Naive hedge: assume basis = historical training average
    naive_expected = float(train["y"].mean())
    naive_error = actual - naive_expected
    var_naive = float(np.var(naive_error, ddof=1))

    # Prophet hedge: assume basis = forecast
    prophet_error = actual - predicted
    var_prophet = float(np.var(prophet_error, ddof=1))

    # Hedging effectiveness
    naive_he = 1 - var_naive / var_unhedged if var_unhedged > 0 else None
    prophet_he = 1 - var_prophet / var_unhedged if var_unhedged > 0 else None

    naive_mse = float(np.mean(naive_error ** 2))
    prophet_mse = float(np.mean(prophet_error ** 2))

    improvement = ((naive_mse - prophet_mse) / naive_mse * 100) if naive_mse > 0 else None

    return {
        "naive_he": round(naive_he, 4) if naive_he is not None else None,
        "prophet_he": round(prophet_he, 4) if prophet_he is not None else None,
        "naive_mse": round(naive_mse, 4),
        "prophet_mse": round(prophet_mse, 4),
        "variance_unhedged": round(var_unhedged, 4),
        "variance_naive": round(var_naive, 4),
        "variance_prophet": round(var_prophet, 4),
        "improvement_over_naive_pct": round(improvement, 1) if improvement is not None else None,
    }
