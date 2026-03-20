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

// Risk metrics types
export interface VaRResult {
  var_95: number | null;
  cvar_95: number | null;
  var_99: number | null;
  cvar_99: number | null;
  observation_count: number;
  mean_change: number | null;
  std_change: number | null;
}

export interface VolatilityPoint {
  date: string;
  basis: number;
  vol_13: number | null;
  vol_26: number | null;
  vol_52: number | null;
}

export interface ConvergenceBucket {
  bucket: string;
  avg_basis: number;
  std_basis: number;
  count: number;
}

export interface ConvergencePoint {
  days_to_expiry: number;
  basis: number;
  date: string;
}

export interface ConvergenceResult {
  by_bucket: ConvergenceBucket[];
  by_point: ConvergencePoint[];
}

export interface AccuracyTestPoint {
  date: string;
  actual: number;
  forecast: number;
  lower: number;
  upper: number;
}

export interface AccuracyResult {
  mae: number | null;
  rmse: number | null;
  mape: number | null;
  coverage_80: number | null;
  test_points: number;
  train_points: number;
  test_data: AccuracyTestPoint[];
}

export interface HedgingResult {
  naive_he: number | null;
  prophet_he: number | null;
  naive_mse: number | null;
  prophet_mse: number | null;
  variance_unhedged: number | null;
  variance_naive: number | null;
  variance_prophet: number | null;
  improvement_over_naive_pct: number | null;
}
