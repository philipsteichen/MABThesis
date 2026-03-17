import { useEffect, useState, useMemo } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { Upload } from "lucide-react";
import { api } from "../api/client";
import type { PriceForecastResponse, PricePoint } from "../types";

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = Math.ceil(arr.length / max);
  return arr.filter((_, i) => i % step === 0);
}

type Source = { id: string; name: string; available: boolean; commodities: string[] };

export default function PriceForecast() {
  const [sources, setSources] = useState<Source[]>([]);
  const [sourceId, setSourceId] = useState("yahoo");
  const [commodity, setCommodity] = useState("");
  const [years, setYears] = useState(1);
  const [file, setFile] = useState<File | null>(null);

  const [priceData, setPriceData] = useState<PricePoint[] | null>(null);
  const [forecastData, setForecastData] = useState<PriceForecastResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [forecasting, setForecasting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataLabel, setDataLabel] = useState("");

  // Load available sources on mount
  useEffect(() => {
    api.getMarketSources().then((res) => {
      setSources(res.sources);
      // Default to first commodity of Yahoo
      const yahoo = res.sources.find((s) => s.id === "yahoo");
      if (yahoo && yahoo.commodities.length > 0) {
        setCommodity(yahoo.commodities[0]);
      }
    });
  }, []);

  const currentSource = sources.find((s) => s.id === sourceId);
  const commodities = currentSource?.commodities ?? [];

  // Reset commodity when source changes
  useEffect(() => {
    if (sourceId !== "upload" && commodities.length > 0 && !commodities.includes(commodity)) {
      setCommodity(commodities[0]);
    }
  }, [sourceId, commodities, commodity]);

  const loadData = async () => {
    setError(null);
    setLoading(true);
    setPriceData(null);
    setForecastData(null);

    try {
      if (sourceId === "upload") {
        if (!file) throw new Error("Please select a CSV file first");
        const res = await api.uploadCsv(file);
        setPriceData(res.data);
        setDataLabel(res.filename);
      } else {
        const res = await api.fetchMarketData({ source: sourceId, commodity });
        setPriceData(res.data);
        setDataLabel(res.commodity);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const runForecast = async () => {
    setError(null);
    setForecasting(true);

    try {
      if (sourceId === "upload" && file) {
        const res = await api.forecastPrice({ years: String(years), file });
        setForecastData(res);
      } else {
        const res = await api.forecastPrice({
          source: sourceId,
          commodity,
          years: String(years),
        });
        setForecastData(res);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Forecast failed");
    } finally {
      setForecasting(false);
    }
  };

  // Build forecast chart data
  const chartData = useMemo(() => {
    if (!forecastData) return [];

    const hist = downsample(forecastData.historical, 800).map((h) => ({
      date: h.date,
      actual: h.price,
      forecast: undefined as number | undefined,
      lower: undefined as number | undefined,
      upper: undefined as number | undefined,
    }));

    const fc = downsample(forecastData.forecast, 500).map((f) => ({
      date: f.date,
      actual: undefined as number | undefined,
      forecast: f.price,
      lower: f.lower,
      upper: f.upper,
    }));

    // Bridge point
    if (hist.length > 0 && fc.length > 0) {
      const last = hist[hist.length - 1];
      fc.unshift({
        date: last.date,
        actual: undefined,
        forecast: last.actual,
        lower: last.actual,
        upper: last.actual,
      });
    }

    return [...hist, ...fc];
  }, [forecastData]);

  const lastHistDate = forecastData?.historical?.length
    ? forecastData.historical[forecastData.historical.length - 1].date
    : null;

  return (
    <div>
      <h2 className="text-2xl font-bold text-kstate-purple">Price Forecast</h2>
      <p className="text-slate-500 mt-1">
        Pull commodity data or upload your own — then forecast with Prophet
      </p>

      {/* Source selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-6">
        <div className="flex flex-wrap items-end gap-4">
          {/* Source tabs */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-2">
              Data Source
            </label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {sources.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSourceId(s.id);
                    setPriceData(null);
                    setForecastData(null);
                  }}
                  disabled={!s.available}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    sourceId === s.id
                      ? "bg-kstate-purple text-white"
                      : s.available
                        ? "bg-white text-slate-600 hover:bg-gray-50"
                        : "bg-gray-100 text-slate-300 cursor-not-allowed"
                  }`}
                >
                  {s.name}
                  {!s.available && " (no key)"}
                </button>
              ))}
            </div>
          </div>

          {/* Commodity dropdown (API sources) */}
          {sourceId !== "upload" && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Commodity
              </label>
              <select
                value={commodity}
                onChange={(e) => setCommodity(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kstate-purple/30"
              >
                {commodities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* File upload */}
          {sourceId === "upload" && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                CSV File (Date &amp; Price columns)
              </label>
              <label className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-gray-50">
                <Upload size={16} className="text-slate-400" />
                <span className="text-slate-600">
                  {file ? file.name : "Choose file..."}
                </span>
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          )}

          <button
            onClick={loadData}
            disabled={loading || (sourceId === "upload" && !file)}
            className="bg-kstate-purple text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-kstate-light transition-colors disabled:opacity-50"
          >
            {loading ? "Loading..." : "Load Data"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Price chart (once data is loaded) */}
      {priceData && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-700">
                  {dataLabel} — Historical Prices
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {priceData.length.toLocaleString()} data points
                </p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={340}>
              <ComposedChart data={downsample(priceData, 1000)}>
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
                    value: "Price",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 12 },
                  }}
                />
                <Tooltip
                  labelFormatter={(v: string) => `Date: ${v}`}
                  formatter={(v: number) => [`$${v.toFixed(4)}`, "Price"]}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="#512888"
                  dot={false}
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Forecast controls */}
          <div className="flex flex-wrap items-end gap-4 mt-4 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
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
              disabled={forecasting}
              className="bg-kstate-purple text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-kstate-light transition-colors disabled:opacity-50"
            >
              {forecasting ? "Running Prophet..." : "Run Forecast"}
            </button>
          </div>
        </>
      )}

      {forecasting && (
        <div className="flex items-center justify-center h-40">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kstate-purple mx-auto" />
            <p className="text-sm text-slate-500 mt-3">Fitting Prophet model...</p>
          </div>
        </div>
      )}

      {/* Forecast results */}
      {forecastData && !forecasting && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-4">
            <h3 className="font-semibold text-slate-700 mb-1">
              {forecastData.label} — Price Forecast
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Solid line = historical, dashed = forecast, shaded = 80% confidence interval
            </p>
            <ResponsiveContainer width="100%" height={440}>
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
                    value: "Price",
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
                        ? "Actual"
                        : name === "forecast"
                          ? "Forecast"
                          : name === "lower"
                            ? "Lower 80%"
                            : name === "upper"
                              ? "Upper 80%"
                              : name;
                    return [`$${v.toFixed(4)}`, label];
                  }}
                />
                <Legend
                  formatter={(v: string) =>
                    v === "actual"
                      ? "Actual"
                      : v === "forecast"
                        ? "Forecast"
                        : v === "upper"
                          ? "80% CI"
                          : v === "lower"
                            ? ""
                            : v
                  }
                />
                <Area
                  type="monotone"
                  dataKey="upper"
                  stroke="none"
                  fill="#512888"
                  fillOpacity={0.1}
                  connectNulls={false}
                  isAnimationActive={false}
                  legendType="none"
                />
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
                  legendType="none"
                />
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
                />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#512888"
                  dot={false}
                  strokeWidth={2}
                  connectNulls={false}
                  isAnimationActive={false}
                />
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
                {lastHistDate && (
                  <ReferenceLine
                    x={lastHistDate}
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

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase">
                Last Price
              </p>
              <p className="text-xl font-bold text-slate-800 mt-1">
                $
                {forecastData.historical.length > 0
                  ? forecastData.historical[forecastData.historical.length - 1].price.toFixed(2)
                  : "N/A"}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase">
                Avg Forecast
              </p>
              <p className="text-xl font-bold text-slate-800 mt-1">
                $
                {forecastData.forecast.length > 0
                  ? (
                      forecastData.forecast.reduce((s, f) => s + f.price, 0) /
                      forecastData.forecast.length
                    ).toFixed(2)
                  : "N/A"}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase">
                Historical Points
              </p>
              <p className="text-xl font-bold text-slate-800 mt-1">
                {forecastData.historical.length.toLocaleString()}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase">
                Forecast Days
              </p>
              <p className="text-xl font-bold text-slate-800 mt-1">
                {forecastData.forecast.length.toLocaleString()}
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
                    <th className="py-2 pr-4 text-right">Forecast</th>
                    <th className="py-2 pr-4 text-right">Lower 80%</th>
                    <th className="py-2 text-right">Upper 80%</th>
                  </tr>
                </thead>
                <tbody>
                  {forecastData.forecast.slice(0, 30).map((f, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 pr-4">{f.date}</td>
                      <td className="py-2 pr-4 text-right font-medium">
                        ${f.price.toFixed(4)}
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
