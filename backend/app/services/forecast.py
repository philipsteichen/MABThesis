import pandas as pd
from prophet import Prophet
from app.services.basis import calculate_basis


def forecast_basis(
    location: str | None = None,
    crop: str = "HRW",
    periods: int = 365,
) -> dict:
    """Forecast basis using Prophet."""
    basis_df = calculate_basis(location=location, crop=crop)

    if basis_df.empty:
        return {"historical": [], "forecast": [], "full_forecast": []}

    # Prepare data for Prophet
    df_train = basis_df[["Date", "basis"]].copy()
    df_train = df_train.rename(columns={"Date": "ds", "basis": "y"})

    # Fit model
    m = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=False,
        daily_seasonality=False,
    )
    m.fit(df_train)

    # Generate forecast
    future = m.make_future_dataframe(periods=periods)
    forecast = m.predict(future)

    # Historical data
    historical = [
        {
            "date": row["Date"].strftime("%Y-%m-%d"),
            "basis": round(float(row["basis"]), 4),
            "cash_price": round(float(row["AdjCashPrice"]), 4),
            "futures_price": round(float(row["futures_price"]), 4),
        }
        for _, row in basis_df.iterrows()
    ]

    # Forecast data (only future dates beyond historical)
    last_date = basis_df["Date"].max()
    future_forecast = forecast[forecast["ds"] > last_date]

    forecast_data = [
        {
            "date": row["ds"].strftime("%Y-%m-%d"),
            "basis": round(float(row["yhat"]), 4),
            "lower": round(float(row["yhat_lower"]), 4),
            "upper": round(float(row["yhat_upper"]), 4),
        }
        for _, row in future_forecast.iterrows()
    ]

    # Full forecast including historical fit
    full_forecast = [
        {
            "date": row["ds"].strftime("%Y-%m-%d"),
            "basis": round(float(row["yhat"]), 4),
            "lower": round(float(row["yhat_lower"]), 4),
            "upper": round(float(row["yhat_upper"]), 4),
        }
        for _, row in forecast.iterrows()
    ]

    return {
        "historical": historical,
        "forecast": forecast_data,
        "full_forecast": full_forecast,
    }
