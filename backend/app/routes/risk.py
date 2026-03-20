from fastapi import APIRouter, Query
from typing import Optional
from app.services.risk import (
    compute_var,
    compute_rolling_volatility,
    compute_convergence,
    compute_forecast_accuracy,
    compute_hedging_effectiveness,
)

router = APIRouter()


@router.get("/var")
def get_var(
    location: Optional[str] = Query(None),
    crop: str = Query("HRW"),
    window: Optional[int] = Query(None),
):
    return compute_var(location=location, crop=crop, window=window)


@router.get("/volatility")
def get_volatility(
    location: Optional[str] = Query(None),
    crop: str = Query("HRW"),
):
    return {"data": compute_rolling_volatility(location=location, crop=crop)}


@router.get("/convergence")
def get_convergence(
    location: Optional[str] = Query(None),
    crop: str = Query("HRW"),
):
    return compute_convergence(location=location, crop=crop)


@router.get("/accuracy")
def get_accuracy(
    location: Optional[str] = Query(None),
    crop: str = Query("HRW"),
):
    return compute_forecast_accuracy(location=location, crop=crop)


@router.get("/hedging")
def get_hedging(
    location: Optional[str] = Query(None),
    crop: str = Query("HRW"),
):
    return compute_hedging_effectiveness(location=location, crop=crop)
