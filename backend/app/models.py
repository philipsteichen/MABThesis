from pydantic import BaseModel
from typing import Optional
from datetime import date


class BasisDataPoint(BaseModel):
    date: date
    location: str
    crop: str
    cash_price: float
    futures_price: float
    basis: float
    futures_contract: str


class BasisSummary(BaseModel):
    location: str
    crop: str
    current_basis: Optional[float]
    avg_basis: float
    min_basis: float
    max_basis: float
    std_basis: float
    data_points: int


class SeasonalBasis(BaseModel):
    month: int
    avg_basis: float
    min_basis: float
    max_basis: float


class ForecastPoint(BaseModel):
    date: date
    basis: float
    lower: float
    upper: float
