import { useEffect, useState, useMemo } from "react";
import {
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
  ComposedChart,
} from "recharts";
import { api } from "../api/client";
import { trackPageView } from "../api/analytics";
import type { ForecastResponse } from "../types";

function downsample<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr;
  const step = Math.ceil(arr.length / maxPoints);
  return arr.filter((_, i) => i % step === 0);
}

export default function BasisForecast() {
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(
    null,
  );
  const [locations, setLocations] = useState<string[]>([]);
  const [location, setLocation] = useState<string>("");
  const [years, setYears] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { trackPageView("/forecast"); }, []);

  useEffect(() => {
    api.getLocations().then((res) => setLocations(res.locations));
  }, []);

  const runForecast = () => {
    setLoading(true);
    setError(null);
    api
      .getForecast({
        location: location || undefined,
        crop: "HRW",
        years: String(years),
      })
      .then((res) => {
        setForecastData(res);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  // Build chart data: historical as one series, forecast+CI as another
  const chartData = useMemo(() => {
    if (!forecastData) return [];

    // Historical points (sampled down for performance)
    const hist = downsample(forecastData.historical, 800).map((h) => ({
      date: h.date,
      actual: h.basis,
      forecast: undefined as number | undefined,
      lower: undefined as number | undefined,
      upper: undefined as number | undefined,
    }));

    // Forecast points (future only, with CI)
    const fc = downsample(forecastData.forecast, 500).map((f) => ({
      date: f.date,
      actual: undefined as number | undefined,
      forecast: f.basis,
      lower: f.lower,
      upper: f.upper,
    }));

    // Bridge point: last historical connects to first forecast
    if (hist.length > 0 && fc.length > 0) {
      const lastHist = hist[hist.length - 1];
      fc.unshift({
        date: lastHist.date,
        actual: undefined,
        forecast: lastHist.actual,
        lower: lastHist.actual,
        upper: lastHist.actual,
      });
    }

    return [...hist, ...fc];
  }, [forecastData]);

  // Historical price data for the reference chart
  const priceData = useMemo(() => {
    if (!forecastData) return [];
    return downsample(forecastData.historical, 800);
  }, [forecastData]);

  const lastHistoricalDate = forecastData?.historical?.length
    ? forecastData.historical[forecastData.historical.length - 1].date
    : null;

  return (
    <div>
      <h2 className="text-2xl font-bold text-kstate-purple">Basis Forecast</h2>
      <p className="text-slate-500 mt-1">
        Prophet-based forecast of HRW wheat basis spreads
      </p>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4 mt-6 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Location
          </label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kstate-purple/30"
          >
            <option value="">All Locations</option>
            {locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Forecast Horizon
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={4}
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="w-32 accent-kstate-purple"
            />
            <span className="text-sm font-medium text-slate-700 w-16">
              {years} {years === 1 ? "year" : "years"}
            </span>
          </div>
        </div>
        <button
          onClick={runForecast}
          disabled={loading}
          className="bg-kstate-purple text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-kstate-light transition-colors disabled:opacity-50"
        >
          {loading ? "Running..." : "Run Forecast"}
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kstate-purple mx-auto" />
            <p className="text-sm text-slate-500 mt-3">
              Fitting Prophet model...
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          Error: {error}
        </div>
      )}

      {forecastData && !loading && (
        <>
          {/* Forecast chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-4">
            <h3 className="font-semibold text-slate-700 mb-4">
              Historical Basis &amp; Forecast
            </h3>
            <ResponsiveContainer width="100%" height={480}>
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7DED0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(0, 7)}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) =>
                    typeof v === "number" ? `$${v.toFixed(2)}` : ""
                  }
                  label={{
                    value: "Basis ($/bu)",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 12 },
                  }}
                />
                <Tooltip
                  labelFormatter={(v: string) => `Date: ${v}`}
                  formatter={(v: number | undefined, name: string) => {
                    if (v === undefined || v === null) return ["-", name];
                    const label =
                      name === "actual"
                        ? "Actual Basis"
                        : name === "forecast"
                          ? "Forecast"
                          : name === "lower"
                            ? "Lower 80%"
                            : name === "upper"
                              ? "Upper 80%"
                              : name;
                    return [`$${v.toFixed(4)}/bu`, label];
                  }}
                />
                <Legend
                  formatter={(value: string) =>
                    value === "actual"
                      ? "Actual Basis"
                      : value === "forecast"
                        ? "Forecast"
                        : value === "upper"
                          ? "80% CI Upper"
                          : value === "lower"
                            ? "80% CI Lower"
                            : value
                  }
                />
                {/* Confidence interval — upper bound filled */}
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="none"
                  fill="#512888"
                  fillOpacity={0.1}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                {/* Lower bound line */}
                <Line
                  type="monotone"
                  dataKey="lower"
                  stroke="#512888"
                  strokeOpacity={0.3}
                  dot={false}
                  strokeWidth={1}
                  strokeDasharray="4 2"
                  connectNulls={false}
                  isAnimationActive={false}
                />
                {/* Upper bound line */}
                <Line
                  type="monotone"
                  dataKey="upper"
                  stroke="#512888"
                  strokeOpacity={0.3}
                  dot={false}
                  strokeWidth={1}
                  strokeDasharray="4 2"
                  connectNulls={false}
                  isAnimationActive={false}
                  legendType="none"
                />
                {/* Actual historical basis */}
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#512888"
                  dot={false}
                  strokeWidth={2}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                {/* Forecast line */}
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#CEA152"
                  dot={false}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  connectNulls={false}
                  isAnimationActive={false}
                />
                {/* Dividing line */}
                {lastHistoricalDate && (
                  <ReferenceLine
                    x={lastHistoricalDate}
                    stroke="#94a3b8"
                    strokeDasharray="3 3"
                    label={{
                      value: "Forecast Start",
                      position: "top",
                      fill: "#94a3b8",
                      fontSize: 11,
                    }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Historical cash & futures reference chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-4">
            <h3 className="font-semibold text-slate-700 mb-1">
              Underlying Prices — Cash &amp; Futures
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Historical HRW cash price vs. nearby KC Wheat futures for context
            </p>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={priceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7DED0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(0, 7)}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                  label={{
                    value: "Price ($/bu)",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 12 },
                  }}
                />
                <Tooltip
                  labelFormatter={(v: string) => `Date: ${v}`}
                  formatter={(v: number, name: string) => [
                    `$${v.toFixed(2)}/bu`,
                    name === "cash_price" ? "Cash Price" : "Futures Price",
                  ]}
                />
                <Legend
                  formatter={(v: string) =>
                    v === "cash_price" ? "Cash Price" : "Futures Price"
                  }
                />
                <Line
                  type="monotone"
                  dataKey="cash_price"
                  stroke="#512888"
                  dot={false}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="futures_price"
                  stroke="#CEA152"
                  dot={false}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Forecast summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Historical Data Points
              </p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {forecastData.historical.length.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Forecast Points
              </p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {forecastData.forecast.length.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Avg Forecast Basis
              </p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {forecastData.forecast.length > 0
                  ? `$${(
                      forecastData.forecast.reduce(
                        (s, f) => s + f.basis,
                        0,
                      ) / forecastData.forecast.length
                    ).toFixed(4)}`
                  : "N/A"}
                <span className="text-sm font-normal text-slate-400 ml-1">
                  /bu
                </span>
              </p>
            </div>
          </div>

          {/* Forecast table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-4">
            <h3 className="font-semibold text-slate-700 mb-4">
              Forecast Data (next 30 days)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4 text-right">Forecast Basis</th>
                    <th className="py-2 pr-4 text-right">Lower 80%</th>
                    <th className="py-2 text-right">Upper 80%</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastData.forecast.slice(0, 30).map((f, i) => (
                    <tr
                      key={i}
                      className="border-b border-gray-50 hover:bg-gray-50"
                    >
                      <td className="py-2 pr-4">{f.date}</td>
                      <td className="py-2 pr-4 text-right font-medium">
                        ${f.basis.toFixed(4)}
                      </td>
                      <td className="py-2 pr-4 text-right text-slate-500">
                        ${f.lower.toFixed(4)}
                      </td>
                      <td className="py-2 text-right text-slate-500">
                        ${f.upper.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
