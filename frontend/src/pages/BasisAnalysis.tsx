import { useEffect, useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Brush,
} from "recharts";
import { api } from "../api/client";
import { trackPageView } from "../api/analytics";
import type { BasisDataPoint } from "../types";

export default function BasisAnalysis() {
  const [data, setData] = useState<BasisDataPoint[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [location, setLocation] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showPrices, setShowPrices] = useState(false);
  const [adjustRolls, setAdjustRolls] = useState(true);

  useEffect(() => { trackPageView("/analysis"); }, []);

  // Fetch filter options on mount
  useEffect(() => {
    api.getLocations().then((res) => setLocations(res.locations));
  }, []);

  // Fetch data when filters change
  useEffect(() => {
    setLoading(true);
    api
      .getBasisData({
        location: location || undefined,
        crop: "HRW",
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        adjust_rolls: String(adjustRolls),
      })
      .then((res) => {
        setData(res.data);
        setLoading(false);
      });
  }, [location, startDate, endDate, adjustRolls]);

  // Downsample for performance if needed
  const chartData = useMemo(() => {
    if (data.length <= 2000) return data;
    const step = Math.ceil(data.length / 2000);
    return data.filter((_, i) => i % step === 0);
  }, [data]);

  return (
    <div>
      <h2 className="text-2xl font-bold text-kstate-purple">Basis Analysis</h2>
      <p className="text-slate-500 mt-1">
        Explore HRW wheat basis spreads with interactive filters
      </p>

      {/* Filters */}
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
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kstate-purple/30"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-kstate-purple/30"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 pb-1 cursor-pointer">
          <input
            type="checkbox"
            checked={showPrices}
            onChange={(e) => setShowPrices(e.target.checked)}
            className="rounded"
          />
          Show Cash &amp; Futures
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600 pb-1 cursor-pointer">
          <input
            type="checkbox"
            checked={adjustRolls}
            onChange={(e) => setAdjustRolls(e.target.checked)}
            className="rounded"
          />
          Roll-Adjusted
        </label>
        <div className="ml-auto text-sm text-slate-500">
          {data.length.toLocaleString()} data points
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kstate-purple" />
        </div>
      ) : (
        <>
          {/* Main chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-4">
            <h3 className="font-semibold text-slate-700 mb-4">
              {showPrices
                ? "Basis, Cash & Futures Prices"
                : "Basis Spread Over Time"}
            </h3>
            <ResponsiveContainer width="100%" height={450}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7DED0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: string) => v.slice(0, 7)}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="basis"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                  label={{
                    value: "$/bu",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 12 },
                  }}
                />
                {showPrices && (
                  <YAxis
                    yAxisId="price"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                    label={{
                      value: "Price ($/bu)",
                      angle: 90,
                      position: "insideRight",
                      style: { fontSize: 12 },
                    }}
                  />
                )}
                <Tooltip
                  labelFormatter={(v: string) => `Date: ${v}`}
                  formatter={(v: number, name: string) => [
                    `$${v.toFixed(4)}/bu`,
                    name === "basis"
                      ? "Basis"
                      : name === "cash_price"
                        ? "Cash"
                        : "Futures",
                  ]}
                />
                <Legend
                  formatter={(value: string) =>
                    value === "basis"
                      ? "Basis"
                      : value === "cash_price"
                        ? "Cash Price"
                        : "Futures Price"
                  }
                />
                <Line
                  yAxisId="basis"
                  type="monotone"
                  dataKey="basis"
                  stroke="#512888"
                  dot={false}
                  strokeWidth={2}
                />
                {showPrices && (
                  <>
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="cash_price"
                      stroke="#512888"
                      dot={false}
                      strokeWidth={1.5}
                    />
                    <Line
                      yAxisId="price"
                      type="monotone"
                      dataKey="futures_price"
                      stroke="#CEA152"
                      dot={false}
                      strokeWidth={1.5}
                    />
                  </>
                )}
                <Brush
                  dataKey="date"
                  height={30}
                  stroke="#512888"
                  tickFormatter={(v: string) => v.slice(0, 7)}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Data table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-4">
            <h3 className="font-semibold text-slate-700 mb-4">
              Recent Data
            </h3>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Location</th>
                    <th className="py-2 pr-4 text-right">Cash ($/bu)</th>
                    <th className="py-2 pr-4 text-right">Futures ($/bu)</th>
                    <th className="py-2 pr-4 text-right">Basis ($/bu)</th>
                    <th className="py-2">Contract</th>
                  </tr>
                </thead>
                <tbody>
                  {data
                    .slice(-50)
                    .reverse()
                    .map((d, i) => (
                      <tr
                        key={i}
                        className="border-b border-gray-50 hover:bg-gray-50"
                      >
                        <td className="py-2 pr-4">{d.date}</td>
                        <td className="py-2 pr-4">{d.location}</td>
                        <td className="py-2 pr-4 text-right">
                          ${d.cash_price.toFixed(2)}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          ${d.futures_price.toFixed(2)}
                        </td>
                        <td
                          className={`py-2 pr-4 text-right font-medium ${
                            d.basis < 0 ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          ${d.basis.toFixed(4)}
                        </td>
                        <td className="py-2 text-slate-500">
                          {d.futures_contract}
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
