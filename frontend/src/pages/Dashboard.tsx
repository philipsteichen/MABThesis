import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { api } from "../api/client";
import type { BasisDataPoint, BasisSummary, SeasonalBasis } from "../types";

const MONTH_LABELS = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function StatCard({
  label,
  value,
  unit,
  color,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  color?: string;
  accent?: boolean;
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
          accent ? "text-white" : color ?? "text-slate-800"
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
    </div>
  );
}

function LocationCard({
  title,
  summary,
}: {
  title: string;
  summary: BasisSummary | null;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2.5 h-2.5 rounded-full bg-wheat-300" />
        <h3 className="font-semibold text-slate-700">{title}</h3>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">
            Latest
          </p>
          <p className="text-lg font-bold text-kstate-purple">
            {summary?.current_basis?.toFixed(2) ?? "N/A"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">
            Average
          </p>
          <p className="text-lg font-bold text-slate-700">
            {summary?.avg_basis?.toFixed(2) ?? "N/A"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-slate-400">
            Std Dev
          </p>
          <p className="text-lg font-bold text-slate-700">
            {summary?.std_basis?.toFixed(2) ?? "N/A"}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState<BasisSummary | null>(null);
  const [colbySummary, setColbySummary] = useState<BasisSummary | null>(null);
  const [salinaSummary, setSalinaSummary] = useState<BasisSummary | null>(null);
  const [basisData, setBasisData] = useState<BasisDataPoint[]>([]);
  const [seasonal, setSeasonal] = useState<SeasonalBasis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getSummary({ crop: "HRW" }),
      api.getSummary({ location: "COLBY", crop: "HRW" }),
      api.getSummary({ location: "SALINA", crop: "HRW" }),
      api.getBasisData({ crop: "HRW" }),
      api.getSeasonal({ crop: "HRW" }),
    ]).then(([sum, colby, salina, data, sea]) => {
      setSummary(sum);
      setColbySummary(colby);
      setSalinaSummary(salina);
      setBasisData(data.data);
      setSeasonal(sea.data);
      setLoading(false);
    }).catch((err) => {
      console.error("Dashboard load error:", err);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kstate-purple" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-kstate-purple">Dashboard</h2>
      <p className="text-slate-500 mt-1">
        HRW Wheat Basis Spread Overview — Kansas Locations
      </p>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <StatCard
          label="Latest Basis"
          value={summary?.current_basis?.toFixed(2) ?? "N/A"}
          unit="$/bu"
          accent
        />
        <StatCard
          label="Average Basis"
          value={summary?.avg_basis?.toFixed(2) ?? "N/A"}
          unit="$/bu"
        />
        <StatCard
          label="Basis Range"
          value={`${summary?.min_basis?.toFixed(2)} / ${summary?.max_basis?.toFixed(2)}`}
          unit="$/bu"
        />
        <StatCard
          label="Data Points"
          value={summary?.data_points?.toLocaleString() ?? "0"}
        />
      </div>

      {/* Location comparison cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <LocationCard title="Colby, KS" summary={colbySummary} />
        <LocationCard title="Salina, KS" summary={salinaSummary} />
      </div>

      {/* Cash & Futures prices chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-6">
        <h3 className="font-semibold text-kstate-purple mb-1">
          Cash &amp; Futures Prices — HRW Wheat
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Adjusted cash price vs. nearby KC Wheat futures ($/bu)
        </p>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={basisData}>
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
              formatter={(value: string) =>
                value === "cash_price" ? "Cash Price" : "Futures Price"
              }
            />
            <Line
              type="monotone"
              dataKey="cash_price"
              stroke="#512888"
              dot={false}
              strokeWidth={1.5}
              name="cash_price"
            />
            <Line
              type="monotone"
              dataKey="futures_price"
              stroke="#CEA152"
              dot={false}
              strokeWidth={1.5}
              name="futures_price"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Basis over time chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-6">
        <h3 className="font-semibold text-kstate-purple mb-1">
          Basis Over Time — HRW Wheat
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Basis = Cash Price - Futures Price
        </p>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={basisData}>
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
                value: "Basis ($/bu)",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 12 },
              }}
            />
            <Tooltip
              labelFormatter={(v: string) => `Date: ${v}`}
              formatter={(v: number) => [`$${v.toFixed(4)}/bu`, "Basis"]}
            />
            <Line
              type="monotone"
              dataKey="basis"
              stroke="#512888"
              dot={false}
              strokeWidth={1.5}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Seasonal pattern */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-6">
        <h3 className="font-semibold text-kstate-purple mb-4">
          Seasonal Basis Pattern — Average by Month
        </h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={seasonal}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E7DED0" />
            <XAxis
              dataKey="month"
              tickFormatter={(m: number) => MONTH_LABELS[m] ?? ""}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            />
            <Tooltip
              labelFormatter={(m: number) => MONTH_LABELS[m]}
              formatter={(v: number, name: string) => [
                `$${v.toFixed(4)}/bu`,
                name === "avg_basis"
                  ? "Average"
                  : name === "min_basis"
                    ? "Min"
                    : "Max",
              ]}
            />
            <Legend
              formatter={(value: string) =>
                value === "avg_basis"
                  ? "Average"
                  : value === "min_basis"
                    ? "Min"
                    : "Max"
              }
            />
            <Bar dataKey="min_basis" fill="#B9AB97" radius={[2, 2, 0, 0]} />
            <Bar dataKey="avg_basis" fill="#512888" radius={[2, 2, 0, 0]} />
            <Bar dataKey="max_basis" fill="#CEA152" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
