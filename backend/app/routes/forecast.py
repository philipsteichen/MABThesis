from fastapi import APIRouter, Query
from typing import Optional
from app.services.forecast import forecast_basis

router = APIRouter()


@router.get("/basis")
def get_basis_forecast(
    location: Optional[str] = Query(None),
    crop: str = Query("HRW"),
    years: int = Query(1, ge=1, le=4),
):
    periods = years * 365
    return forecast_basis(location=location, crop=crop, periods=periods)
