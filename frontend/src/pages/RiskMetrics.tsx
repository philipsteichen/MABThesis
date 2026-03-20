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
  ComposedChart,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  Cell,
} from "recharts";
import { api } from "../api/client";
import { trackPageView } from "../api/analytics";
import type {
  VaRResult,
  VolatilityPoint,
  ConvergenceResult,
  AccuracyResult,
  HedgingResult,
} from "../types";

function StatCard({
  label,
  value,
  unit,
  accent,
  subtext,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
  subtext?: string;
}) {
  return (
    <div
      className={`rounded-xl shadow-sm p-5 ${
        accent
          ? "bg-kstate-purple text-white"
          : "bg-white border border-gray-100"
      }`}
    >
      <p
        className={`text-xs font-medium uppercase tracking-wide ${
          accent ? "text-wheat-100" : "text-slate-500"
        }`}
      >
        {label}
      </p>
      <p
        className={`text-2xl font-bold mt-1 ${
          accent ? "text-white" : "text-slate-800"
        }`}
      >
        {value}
        {unit && (
          <span
            className={`text-sm font-normal ml-1 ${
              accent ? "text-wheat-100" : "text-slate-400"
            }`}
          >
            {unit}
          </span>
        )}
      </p>
      {subtext && (
        <p
          className={`text-xs mt-1 ${
            accent ? "text-wheat-100/70" : "text-slate-400"
          }`}
        >
          {subtext}
        </p>
      )}
    </div>
  );
}

function downsample<T>(arr: T[], maxPoints: number): T[] {
  if (arr.length <= maxPoints) return arr;
  const step = Math.ceil(arr.length / maxPoints);
  return arr.filter((_, i) => i % step === 0);
}

export default function RiskMetrics() {
  const [locations, setLocations] = useState<string[]>([]);
  const [location, setLocation] = useState<string>("");

  const [varData, setVarData] = useState<VaRResult | null>(null);
  const [volData, setVolData] = useState<VolatilityPoint[]>([]);
  const [convergence, setConvergence] = useState<ConvergenceResult | null>(null);
  const [accuracy, setAccuracy] = useState<AccuracyResult | null>(null);
  const [hedging, setHedging] = useState<HedgingResult | null>(null);

  const [loadingQuick, setLoadingQuick] = useState(true);
  const [loadingSlow, setLoadingSlow] = useState(true);

  useEffect(() => {
    trackPageView("/risk");
  }, []);

  useEffect(() => {
    api.getLocations().then((res) => setLocations(res.locations));
  }, []);

  // Fetch fast endpoints (VaR, volatility, convergence)
  useEffect(() => {
    setLoadingQuick(true);
    const params = { location: location || undefined, crop: "HRW" };
    Promise.all([
      api.getVaR(params as Record<string, string>),
      api.getVolatility(params as Record<string, string>),
      api.getConvergence(params as Record<string, string>),
    ])
      .then(([v, vol, conv]) => {
        setVarData(v);
        setVolData(vol.data);
        setConvergence(conv);
        setLoadingQuick(false);
      })
      .catch((err) => {
        console.error("Risk quick-load error:", err);
        setLoadingQuick(false);
      });
  }, [location]);

  // Fetch slow endpoints (Prophet-based: accuracy, hedging) separately
  useEffect(() => {
    setLoadingSlow(true);
    const params = { location: location || undefined, crop: "HRW" };
    Promise.all([
      api.getAccuracy(params as Record<string, string>),
      api.getHedging(params as Record<string, string>),
    ])
      .then(([acc, hedge]) => {
        setAccuracy(acc);
        setHedging(hedge);
        setLoadingSlow(false);
      })
      .catch((err) => {
        console.error("Risk slow-load error:", err);
        setLoadingSlow(false);
      });
  }, [location]);

  const volChartData = useMemo(() => downsample(volData, 1000), [volData]);

  const accuracyChartData = useMemo(() => {
    if (!accuracy?.test_data) return [];
    return accuracy.test_data.map((d) => ({
      ...d,
      ciRange: [d.lower, d.upper],
    }));
  }, [accuracy]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-kstate-purple">
            Risk Management Metrics
          </h2>
          <p className="text-slate-500 mt-1">
            Quantitative risk analysis for HRW wheat basis positions
          </p>
        </div>
      </div>

      {/* Location filter */}
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
        <div className="ml-auto text-sm text-slate-500">
          {varData
            ? `${varData.observation_count.toLocaleString()} weekly observations`
            : "Loading..."}
        </div>
      </div>

      {loadingQuick ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kstate-purple" />
        </div>
      ) : (
        <>
          {/* ── Section 1: Value at Risk ── */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-kstate-purple mb-1">
              Value at Risk (VaR)
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Maximum expected weekly basis change at given confidence levels.
              Based on historical simulation of week-over-week basis movements.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="VaR (95%)"
                value={
                  varData?.var_95 != null ? `$${varData.var_95.toFixed(4)}` : "N/A"
                }
                unit="/bu"
                accent
                subtext="1-in-20 week worst case"
              />
              <StatCard
                label="CVaR (95%)"
                value={
                  varData?.cvar_95 != null
                    ? `$${varData.cvar_95.toFixed(4)}`
                    : "N/A"
                }
                unit="/bu"
                subtext="Expected loss beyond VaR"
              />
              <StatCard
                label="VaR (99%)"
                value={
                  varData?.var_99 != null ? `$${varData.var_99.toFixed(4)}` : "N/A"
                }
                unit="/bu"
                subtext="1-in-100 week worst case"
              />
              <StatCard
                label="CVaR (99%)"
                value={
                  varData?.cvar_99 != null
                    ? `$${varData.cvar_99.toFixed(4)}`
                    : "N/A"
                }
                unit="/bu"
                subtext="Extreme tail risk"
              />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              <StatCard
                label="Mean Weekly Change"
                value={
                  varData?.mean_change != null
                    ? `$${varData.mean_change.toFixed(4)}`
                    : "N/A"
                }
                unit="/bu"
              />
              <StatCard
                label="Std Dev of Changes"
                value={
                  varData?.std_change != null
                    ? `$${varData.std_change.toFixed(4)}`
                    : "N/A"
                }
                unit="/bu"
              />
            </div>
          </div>

          {/* ── Section 2: Rolling Volatility ── */}
          <div className="mt-10">
            <h3 className="text-lg font-semibold text-kstate-purple mb-1">
              Rolling Volatility
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Rolling standard deviation of basis over 13-week (~3mo), 26-week
              (~6mo), and 52-week (~1yr) windows
            </p>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <ResponsiveContainer width="100%" height={420}>
                <ComposedChart data={volChartData}>
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
                      value: "$/bu",
                      angle: -90,
                      position: "insideLeft",
                      style: { fontSize: 12 },
                    }}
                  />
                  <Tooltip
                    labelFormatter={(v: string) => `Date: ${v}`}
                    formatter={(v: number, name: string) => {
                      if (v === null || v === undefined) return ["-", name];
                      const labels: Record<string, string> = {
                        basis: "Basis",
                        vol_13: "13-Week Vol",
                        vol_26: "26-Week Vol",
                        vol_52: "52-Week Vol",
                      };
                      return [`$${v.toFixed(4)}/bu`, labels[name] ?? name];
                    }}
                  />
                  <Legend
                    formatter={(v: string) =>
                      ({
                        basis: "Basis",
                        vol_13: "13-Week Volatility",
                        vol_26: "26-Week Volatility",
                        vol_52: "52-Week Volatility",
                      })[v] ?? v
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="basis"
                    stroke="#512888"
                    dot={false}
                    strokeWidth={1.5}
                    strokeOpacity={0.4}
                  />
                  <Line
                    type="monotone"
                    dataKey="vol_13"
                    stroke="#CEA152"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="vol_26"
                    stroke="#512888"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="vol_52"
                    stroke="#B9AB97"
                    dot={false}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Section 3: Basis Convergence ── */}
          <div className="mt-10">
            <h3 className="text-lg font-semibold text-kstate-purple mb-1">
              Basis Convergence
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              How basis narrows as the futures contract approaches expiration.
              Basis should converge toward zero near delivery.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bucket averages */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">
                  Average Basis by Days to Expiry
                </h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={convergence?.by_bucket ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7DED0" />
                    <XAxis
                      dataKey="bucket"
                      tick={{ fontSize: 11 }}
                      label={{
                        value: "Days to Expiry",
                        position: "insideBottom",
                        offset: -5,
                        style: { fontSize: 12 },
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) => [
                        `$${v.toFixed(4)}/bu`,
                        name === "avg_basis" ? "Avg Basis" : "Std Dev",
                      ]}
                    />
                    <Bar
                      dataKey="avg_basis"
                      fill="#512888"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Scatter plot */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">
                  Individual Observations
                </h4>
                <ResponsiveContainer width="100%" height={300}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7DED0" />
                    <XAxis
                      dataKey="days_to_expiry"
                      type="number"
                      tick={{ fontSize: 11 }}
                      name="Days to Expiry"
                      label={{
                        value: "Days to Expiry",
                        position: "insideBottom",
                        offset: -5,
                        style: { fontSize: 12 },
                      }}
                    />
                    <YAxis
                      dataKey="basis"
                      type="number"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                      name="Basis"
                    />
                    <Tooltip
                      formatter={(v: number, name: string) => [
                        name === "Basis" ? `$${v.toFixed(4)}/bu` : v,
                        name,
                      ]}
                    />
                    <Scatter
                      data={convergence?.by_point ?? []}
                      fill="#512888"
                      fillOpacity={0.4}
                    >
                      {(convergence?.by_point ?? []).map((_, i) => (
                        <Cell key={i} r={2} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Section 4: Forecast Accuracy ── */}
      <div className="mt-10">
        <h3 className="text-lg font-semibold text-kstate-purple mb-1">
          Forecast Accuracy
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Prophet model evaluated on a held-out 20% test set. The model is
          trained on the first 80% of historical data and tested against
          actual outcomes.
        </p>
        {loadingSlow ? (
          <div className="flex items-center justify-center h-48">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kstate-purple mx-auto" />
              <p className="text-sm text-slate-500 mt-3">
                Fitting Prophet model for backtesting...
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="MAE"
                value={
                  accuracy?.mae != null ? `$${accuracy.mae.toFixed(4)}` : "N/A"
                }
                unit="/bu"
                accent
                subtext="Mean Absolute Error"
              />
              <StatCard
                label="RMSE"
                value={
                  accuracy?.rmse != null
                    ? `$${accuracy.rmse.toFixed(4)}`
                    : "N/A"
                }
                unit="/bu"
                subtext="Root Mean Squared Error"
              />
              <StatCard
                label="MAPE"
                value={
                  accuracy?.mape != null ? `${accuracy.mape.toFixed(1)}%` : "N/A"
                }
                subtext="Mean Abs % Error"
              />
              <StatCard
                label="80% CI Coverage"
                value={
                  accuracy?.coverage_80 != null
                    ? `${accuracy.coverage_80.toFixed(1)}%`
                    : "N/A"
                }
                subtext={`${accuracy?.test_points ?? 0} test points`}
              />
            </div>

            {/* Actual vs forecast chart */}
            {accuracyChartData.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-4">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">
                  Actual vs. Forecast (Test Period)
                </h4>
                <ResponsiveContainer width="100%" height={380}>
                  <ComposedChart data={accuracyChartData}>
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
                      formatter={(v: number, name: string) => [
                        `$${v.toFixed(4)}/bu`,
                        name === "actual"
                          ? "Actual"
                          : name === "forecast"
                            ? "Forecast"
                            : name === "upper"
                              ? "Upper 80%"
                              : name === "lower"
                                ? "Lower 80%"
                                : name,
                      ]}
                    />
                    <Legend
                      formatter={(v: string) =>
                        ({
                          actual: "Actual Basis",
                          forecast: "Prophet Forecast",
                          upper: "80% CI",
                        })[v] ?? v
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="upper"
                      stroke="none"
                      fill="#512888"
                      fillOpacity={0.08}
                    />
                    <Line
                      type="monotone"
                      dataKey="lower"
                      stroke="#512888"
                      strokeOpacity={0.2}
                      dot={false}
                      strokeWidth={1}
                      strokeDasharray="4 2"
                      legendType="none"
                    />
                    <Line
                      type="monotone"
                      dataKey="upper"
                      stroke="#512888"
                      strokeOpacity={0.2}
                      dot={false}
                      strokeWidth={1}
                      strokeDasharray="4 2"
                    />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="#512888"
                      dot={false}
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecast"
                      stroke="#CEA152"
                      dot={false}
                      strokeWidth={2}
                      strokeDasharray="6 3"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Section 5: Hedging Effectiveness ── */}
      <div className="mt-10 mb-8">
        <h3 className="text-lg font-semibold text-kstate-purple mb-1">
          Hedging Effectiveness
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Compares variance reduction from a Prophet-informed hedge vs. a naive
          hedge (using the historical average basis). Higher HE means better
          risk reduction.
        </p>
        {loadingSlow ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-kstate-purple" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Naive hedge */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Naive Hedge (Historical Avg)
              </p>
              <p className="text-3xl font-bold text-slate-700 mt-2">
                {hedging?.naive_he != null
                  ? `${(hedging.naive_he * 100).toFixed(1)}%`
                  : "N/A"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Hedging effectiveness
              </p>
              <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-slate-400">MSE</p>
                  <p className="font-medium text-slate-700">
                    {hedging?.naive_mse != null
                      ? hedging.naive_mse.toFixed(4)
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Variance</p>
                  <p className="font-medium text-slate-700">
                    {hedging?.variance_naive != null
                      ? hedging.variance_naive.toFixed(4)
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>

            {/* Prophet hedge */}
            <div className="bg-kstate-purple rounded-xl shadow-sm p-5 text-white">
              <p className="text-xs font-medium text-wheat-100 uppercase tracking-wide">
                Prophet Forecast Hedge
              </p>
              <p className="text-3xl font-bold text-white mt-2">
                {hedging?.prophet_he != null
                  ? `${(hedging.prophet_he * 100).toFixed(1)}%`
                  : "N/A"}
              </p>
              <p className="text-xs text-wheat-100/70 mt-1">
                Hedging effectiveness
              </p>
              <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-wheat-100/60">MSE</p>
                  <p className="font-medium text-white">
                    {hedging?.prophet_mse != null
                      ? hedging.prophet_mse.toFixed(4)
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-wheat-100/60">Improvement vs Naive</p>
                  <p className="font-medium text-white">
                    {hedging?.improvement_over_naive_pct != null
                      ? `${hedging.improvement_over_naive_pct.toFixed(1)}%`
                      : "N/A"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {!loadingSlow && hedging?.variance_unhedged != null && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mt-4">
            <p className="text-xs text-slate-500">
              <span className="font-medium">Unhedged basis variance:</span>{" "}
              {hedging.variance_unhedged.toFixed(4)} — This is the baseline
              risk exposure without any hedging strategy.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
