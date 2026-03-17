from fastapi import APIRouter, Query, UploadFile, File, HTTPException
from typing import Optional
from prophet import Prophet
import pandas as pd

from app.services.market_data import (
    fetch_yahoo,
    fetch_barchart,
    parse_uploaded_csv,
    get_available_sources,
    YAHOO_COMMODITIES,
    BARCHART_COMMODITIES,
)

router = APIRouter()


@router.get("/sources")
def list_sources():
    """List available data sources and their commodities."""
    return {"sources": get_available_sources()}


@router.get("/fetch")
def fetch_market_data(
    source: str = Query(..., description="yahoo or barchart"),
    commodity: str = Query(..., description="Commodity name"),
    start_date: Optional[str] = Query("2000-01-01"),
):
    """Fetch historical price data from a market data provider."""
    try:
        if source == "yahoo":
            symbol = YAHOO_COMMODITIES.get(commodity)
            if not symbol:
                raise HTTPException(400, f"Unknown commodity: {commodity}")
            df = fetch_yahoo(symbol, start_date=start_date)
        elif source == "barchart":
            symbol = BARCHART_COMMODITIES.get(commodity)
            if not symbol:
                raise HTTPException(400, f"Unknown commodity: {commodity}")
            # Barchart wants YYYYMMDD format
            bc_date = start_date.replace("-", "") if start_date else "20000101"
            df = fetch_barchart(symbol, start_date=bc_date)
        else:
            raise HTTPException(400, f"Unknown source: {source}")
    except ValueError as e:
        raise HTTPException(400, str(e))

    records = df.to_dict(orient="records")
    return {"data": records, "count": len(records), "commodity": commodity, "source": source}


@router.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    """Upload a CSV file with Date and Price columns."""
    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(400, "Please upload a CSV file")

    content = await file.read()
    try:
        df = parse_uploaded_csv(content)
    except ValueError as e:
        raise HTTPException(400, str(e))

    records = df.to_dict(orient="records")
    return {"data": records, "count": len(records), "filename": file.filename}


@router.post("/forecast")
async def forecast_price(
    source: Optional[str] = Query(None),
    commodity: Optional[str] = Query(None),
    start_date: Optional[str] = Query("2000-01-01"),
    years: int = Query(1, ge=1, le=4),
    file: Optional[UploadFile] = File(None),
):
    """Run Prophet forecast on market data or uploaded CSV."""
    # Get the data
    if file and file.filename:
        content = await file.read()
        try:
            df = parse_uploaded_csv(content)
        except ValueError as e:
            raise HTTPException(400, str(e))
        label = file.filename
    elif source and commodity:
        try:
            if source == "yahoo":
                symbol = YAHOO_COMMODITIES.get(commodity)
                if not symbol:
                    raise HTTPException(400, f"Unknown commodity: {commodity}")
                df = fetch_yahoo(symbol, start_date=start_date)
            elif source == "barchart":
                symbol = BARCHART_COMMODITIES.get(commodity)
                if not symbol:
                    raise HTTPException(400, f"Unknown commodity: {commodity}")
                bc_date = start_date.replace("-", "") if start_date else "20000101"
                df = fetch_barchart(symbol, start_date=bc_date)
            else:
                raise HTTPException(400, f"Unknown source: {source}")
        except ValueError as e:
            raise HTTPException(400, str(e))
        label = commodity
    else:
        raise HTTPException(400, "Provide either a file upload or source + commodity")

    if len(df) < 10:
        raise HTTPException(400, f"Not enough data points ({len(df)}). Need at least 10.")

    # Run Prophet
    df_train = df.rename(columns={"date": "ds", "price": "y"})
    df_train["ds"] = pd.to_datetime(df_train["ds"])

    m = Prophet(yearly_seasonality=True, weekly_seasonality=False, daily_seasonality=False)
    m.fit(df_train)

    periods = years * 365
    future = m.make_future_dataframe(periods=periods)
    forecast = m.predict(future)

    last_date = df_train["ds"].max()

    historical = [
        {"date": row["date"], "price": round(float(row["price"]), 4)}
        for _, row in df.iterrows()
    ]

    future_fc = forecast[forecast["ds"] > last_date]
    forecast_out = [
        {
            "date": row["ds"].strftime("%Y-%m-%d"),
            "price": round(float(row["yhat"]), 4),
            "lower": round(float(row["yhat_lower"]), 4),
            "upper": round(float(row["yhat_upper"]), 4),
        }
        for _, row in future_fc.iterrows()
    ]

    full_fc = [
        {
            "date": row["ds"].strftime("%Y-%m-%d"),
            "price": round(float(row["yhat"]), 4),
            "lower": round(float(row["yhat_lower"]), 4),
            "upper": round(float(row["yhat_upper"]), 4),
        }
        for _, row in forecast.iterrows()
    ]

    return {
        "label": label,
        "historical": historical,
        "forecast": forecast_out,
        "full_forecast": full_fc,
    }
