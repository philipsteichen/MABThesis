export interface BasisDataPoint {
  date: string;
  location: string;
  crop: string;
  cash_price: number;
  futures_price: number;
  basis: number;
  futures_contract: string;
}

export interface BasisSummary {
  location: string;
  crop: string;
  current_basis: number | null;
  avg_basis: number;
  min_basis: number;
  max_basis: number;
  std_basis: number;
  data_points: number;
}

export interface SeasonalBasis {
  month: number;
  avg_basis: number;
  min_basis: number;
  max_basis: number;
  std_basis: number;
  count: number;
}

export interface ForecastPoint {
  date: string;
  basis: number;
  lower: number;
  upper: number;
}

export interface HistoricalPoint {
  date: string;
  basis: number;
  cash_price: number;
  futures_price: number;
}

export interface ForecastResponse {
  historical: HistoricalPoint[];
  forecast: ForecastPoint[];
  full_forecast: ForecastPoint[];
}

export interface PricePoint {
  date: string;
  price: number;
}

export interface PriceForecastPoint {
  date: string;
  price: number;
  lower: number;
  upper: number;
}

export interface PriceForecastResponse {
  label: string;
  historical: PricePoint[];
  forecast: PriceForecastPoint[];
  full_forecast: PriceForecastPoint[];
}
