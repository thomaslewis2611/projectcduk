import * as React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceDot,
} from "recharts";
import {
  fetchBuildingTypes,
  fetchComparison,
  fetchRegions,
  fetchYears,
  type ComparisonRow,
} from "@/lib/data.functions";
import { TrendingUp, Filter } from "lucide-react";

export default function IndexChart() {
  const [data, setData] = React.useState<ComparisonRow[]>([]);
  const [years, setYears] = React.useState<number[]>([]);
  const [regions, setRegions] = React.useState<string[]>([]);
  const [buildingTypes, setBuildingTypes] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [chartType, setChartType] = React.useState<"line" | "bar">("line");

  // Filters
  const [selRegion, setSelRegion] = React.useState("");
  const [selBuildingType, setSelBuildingType] = React.useState("");
  const [selYear, setSelYear] = React.useState<number | "all">("all");

  React.useEffect(() => {
    const loadOptions = async () => {
      const [y, r, bt] = await Promise.all([fetchYears(), fetchRegions(), fetchBuildingTypes()]);
      setYears(y);
      setRegions(r);
      setBuildingTypes(bt);
    };
    loadOptions();
  }, []);

  const loadData = async () => {
    const params = {
      region: selRegion || undefined,
      building_type: selBuildingType || undefined,
      year: selYear === "all" ? undefined : selYear,
    };

    setLoading(true);
    try {
      const result = await fetchComparison({ data: params });
      setData(result);
    } catch (err) {
      console.error("Failed to load chart data:", err);
    } finally {
      setLoading(false);
    }
  };

  /* eslint-disable react-hooks/exhaustive-deps */
  React.useEffect(() => {
    loadData();
  }, [selRegion, selBuildingType, selYear]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // Group into series
  const COLORS = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#84cc16",
    "#f97316",
  ];

  const groups: Record<string, { label: string; data: { period: string; value: number }[] }> = {};

  data.forEach((row) => {
    const key = `${row.region ?? "—"}|${row.building_type ?? "—"}`;
    const label = `${row.region ?? "Unknown"} — ${row.building_type ?? "Unknown"}`;
    if (!groups[key]) groups[key] = { label, data: [] };

    const period = periodLabel(row);
    const value = row.index_value ?? row.price_per_sqft ?? null;
    if (value !== null) {
      groups[key].data.push({ period, value });
    }
  });

  // Rows arrive ordered by year then quarter; a string sort would put "Q1 2025" before "Q2 2024".
  const uniquePeriods = Array.from(new Set(data.map(periodLabel)));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters:</span>
        </div>

        <select
          value={selRegion}
          onChange={(e) => setSelRegion(e.target.value)}
          className="text-sm border border-gray-300 rounded px-3 py-1 focus:ring-2 focus:ring-cpi-blue focus:border-transparent"
        >
          <option value="">All Regions</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <select
          value={selBuildingType}
          onChange={(e) => setSelBuildingType(e.target.value)}
          className="text-sm border border-gray-300 rounded px-3 py-1 focus:ring-2 focus:ring-cpi-blue focus:border-transparent"
        >
          <option value="">All Building Types</option>
          {buildingTypes.map((bt) => (
            <option key={bt} value={bt}>
              {bt}
            </option>
          ))}
        </select>

        <select
          value={selYear}
          onChange={(e) => setSelYear(e.target.value === "all" ? "all" : Number(e.target.value))}
          className="text-sm border border-gray-300 rounded px-3 py-1 focus:ring-2 focus:ring-cpi-blue focus:border-transparent"
        >
          <option value="all">All Years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <div className="flex gap-1">
          <button
            onClick={() => setChartType("line")}
            className={`px-3 py-1 text-sm rounded ${
              chartType === "line" ? "bg-cpi-blue text-white" : "bg-gray-200 text-gray-700"
            }`}
          >
            Line
          </button>
          <button
            onClick={() => setChartType("bar")}
            className={`px-3 py-1 text-sm rounded ${
              chartType === "bar" ? "bg-cpi-blue text-white" : "bg-gray-200 text-gray-700"
            }`}
          >
            Bar
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="h-96 w-full">
        {loading ? (
          <div className="flex h-full items-center justify-center text-gray-500">
            Loading chart data…
          </div>
        ) : Object.keys(groups).length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <TrendingUp size={48} className="text-gray-300 mb-4" />
            <p className="text-gray-500">No data matches the current filters.</p>
            <p className="text-sm text-gray-400 mt-2">Adjust your filters or upload PDF reports.</p>
          </div>
        ) : chartType === "line" ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={uniquePeriods.map((period) => {
                const entry: Record<string, unknown> = { period };
                Object.entries(groups).forEach(([key, group], i) => {
                  const match = group.data.find((d) => d.period === period);
                  entry[key] = match ? match.value : null;
                });
                return entry;
              })}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Legend />
              {Object.entries(groups).map(([key, group], i) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={COLORS[i % COLORS.length]}
                  name={group.label}
                  dot={{ r: 4 }}
                  strokeWidth={2}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              barSize={20}
              data={uniquePeriods.map((period) => {
                const entry: Record<string, unknown> = { period };
                Object.entries(groups).forEach(([key, group], i) => {
                  const match = group.data.find((d) => d.period === period);
                  entry[key] = match ? match.value : 0;
                });
                return entry;
              })}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Legend />
              {Object.entries(groups).map(([key, group], i) => (
                <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} name={group.label} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function periodLabel(row: ComparisonRow): string {
  return row.quarter ?? (row.year !== null ? String(row.year) : "Unknown");
}
