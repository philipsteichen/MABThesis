from fastapi import APIRouter, Query
from typing import Optional
from app.services.basis import (
    calculate_basis,
    get_basis_summary,
    get_seasonal_basis,
    get_basis_by_year,
)
from app.services.data_loader import get_available_locations, get_available_crops

router = APIRouter()


@router.get("/data")
def get_basis_data(
    location: Optional[str] = Query(None),
    crop: str = Query("HRW"),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    adjust_rolls: bool = Query(True),
):
    basis_df = calculate_basis(
        location=location, crop=crop, start_date=start_date, end_date=end_date,
        adjust_rolls=adjust_rolls,
    )

    records = [
        {
            "date": row["Date"].strftime("%Y-%m-%d"),
            "location": row["location"],
            "crop": row["CropName"],
            "cash_price": round(float(row["AdjCashPrice"]), 4),
            "futures_price": round(float(row["futures_price"]), 4),
            "basis": round(float(row["basis"]), 4),
            "futures_contract": row["Futures_Contract_Type"],
        }
        for _, row in basis_df.iterrows()
    ]

    return {"data": records, "count": len(records)}


@router.get("/locations")
def get_locations():
    return {"locations": get_available_locations()}


@router.get("/crops")
def get_crops():
    return {"crops": get_available_crops()}


@router.get("/summary")
def get_summary(
    location: Optional[str] = Query(None),
    crop: str = Query("HRW"),
    adjust_rolls: bool = Query(True),
):
    return get_basis_summary(location=location, crop=crop, adjust_rolls=adjust_rolls)


@router.get("/seasonal")
def get_seasonal(
    location: Optional[str] = Query(None),
    crop: str = Query("HRW"),
    adjust_rolls: bool = Query(True),
):
    return {"data": get_seasonal_basis(location=location, crop=crop, adjust_rolls=adjust_rolls)}


@router.get("/by-year")
def get_by_year(
    location: Optional[str] = Query(None),
    crop: str = Query("HRW"),
    adjust_rolls: bool = Query(True),
):
    return {"data": get_basis_by_year(location=location, crop=crop, adjust_rolls=adjust_rolls)}
