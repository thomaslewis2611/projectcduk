import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDown, ArrowUp, TrendingUp } from "lucide-react";
import { fetchTpiForecasts, type TpiForecastRow } from "@/lib/tpi.functions";
import { GT_REGIONS } from "@/lib/tpi/gt-parser";

export const Route = createFileRoute("/forecasts")({
  component: ForecastsPage,
});

// Categorical slots 1–4 in fixed order (validated: CVD-safe on a light surface;
// slots 3–4 are below 3:1 contrast, so lines are direct-labelled and the table
// below carries every value).
const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];

type Period = { key: string; label: string };

function periodKey(row: TpiForecastRow): string {
  return `${row.period_year}-${row.period_quarter}`;
}

const pct = (v: number | null | undefined) => (v == null ? "N/A" : `${v.toFixed(2)}%`);

function ForecastsPage() {
  const [rows, setRows] = React.useState<TpiForecastRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [region, setRegion] = React.useState<string>("UK Average");

  React.useEffect(() => {
    fetchTpiForecasts()
      .then(setRows)
      .catch((err) => console.error("Failed to load forecasts:", err))
      .finally(() => setLoading(false));
  }, []);

  // Reports in date order (rows arrive sorted by period).
  const periods: Period[] = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) seen.set(periodKey(r), r.period_label ?? String(r.period_year));
    return [...seen].map(([key, label]) => ({ key, label }));
  }, [rows]);

  const latest = periods[periods.length - 1];
  const latestRows = rows.filter((r) => latest && periodKey(r) === latest.key);
  const latestYears = [...new Set(latestRows.map((r) => r.forecast_year))].sort();
  const publisher = latestRows[0]?.publisher ?? "Gardiner & Theobald";

  // One line per forecast year in the latest report: how that year's forecast
  // moved from report to report.
  const chartData = periods.map((p) => {
    const point: Record<string, string | number | null> = { period: p.label };
    for (const year of latestYears) {
      const match = rows.find(
        (r) => periodKey(r) === p.key && r.region === region && r.forecast_year === year,
      );
      point[String(year)] = match?.change_pct ?? null;
    }
    return point;
  });

  // Direct labels at each line's end. Lines that end on the same value share
  // one label ("2027, 2028") instead of overprinting each other.
  const lastIndex = chartData.length - 1;
  const endLabels = new Map<number, string>();
  {
    const byValue = new Map<string, number[]>();
    for (const year of latestYears) {
      const v = chartData[lastIndex]?.[String(year)];
      if (v == null) continue;
      byValue.set(String(v), [...(byValue.get(String(v)) ?? []), year]);
    }
    for (const years of byValue.values()) endLabels.set(years[0], years.join(", "));
  }
  const maxValue = Math.max(
    0,
    ...chartData.flatMap((p) => latestYears.map((y) => Number(p[String(y)] ?? 0))),
  );
  const yTicks = Array.from({ length: Math.ceil(maxValue) + 1 }, (_, i) => i);

  if (loading) return <div className="py-12 text-center text-gray-500">Loading forecasts…</div>;

  if (!latest) {
    return (
      <div className="card text-center py-12">
        <TrendingUp size={48} className="mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">No forecasts yet. Import reports to see them here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Tender price inflation forecasts</h1>
        <p className="text-sm text-gray-500 mt-1">
          Forecast annual % change in UK construction tender prices (January–December), by region.
          Averages across all sectors and project sizes.
        </p>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-800">
            How the forecasts have moved — {region}
          </h2>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="text-sm border border-gray-300 rounded px-3 py-1"
            aria-label="Region"
          >
            {GT_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 88, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 12, fill: "#6b7280" }} />
              <YAxis
                ticks={yTicks}
                domain={[0, yTicks[yTicks.length - 1]]}
                tickFormatter={(v: number) => `${v}%`}
                tick={{ fontSize: 12, fill: "#6b7280" }}
                width={48}
              />
              <Tooltip
                formatter={(value: number, name: string) => [pct(value), `${name} forecast`]}
              />
              <Legend formatter={(value) => <span className="text-gray-700">{value}</span>} />
              {latestYears.map((year, i) => (
                <Line
                  key={year}
                  type="linear"
                  dataKey={String(year)}
                  name={String(year)}
                  stroke={SERIES_COLORS[i]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls
                  label={(props: { x?: number; y?: number; index?: number }) =>
                    props.index === lastIndex && endLabels.has(year) ? (
                      <text
                        key={year}
                        x={(props.x ?? 0) + 8}
                        y={(props.y ?? 0) + 4}
                        fontSize={12}
                        fill="#374151"
                      >
                        {endLabels.get(year)}
                      </text>
                    ) : (
                      <g key={`${year}-${props.index}`} />
                    )
                  }
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Each line is one calendar year; each point is what that report forecast for it.
        </p>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="text-lg font-semibold text-gray-800 mb-1">Latest forecasts</h2>
        <p className="text-sm text-gray-500 mb-4">
          {publisher} {latest.label}. Arrows show the change from the previous report.
        </p>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-gray-500">
              <th className="py-2 pr-4">Region</th>
              {latestYears.map((y) => (
                <th key={y} className="py-2 px-3 text-right">
                  {y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {GT_REGIONS.map((r) => (
              <tr key={r} className={r === "UK Average" ? "font-semibold" : undefined}>
                <td className="py-2 pr-4 text-gray-900">{r}</td>
                {latestYears.map((y) => {
                  const cell = latestRows.find(
                    (row) => row.region === r && row.forecast_year === y,
                  );
                  return (
                    <td key={y} className="py-2 px-3 text-right text-gray-900 whitespace-nowrap">
                      {pct(cell?.change_pct)}
                      <Revision
                        now={cell?.change_pct ?? null}
                        previous={cell?.previous_change_pct ?? null}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-500 mt-4">
          Source: {publisher} Tender Price Indicator reports (
          <a
            href="https://marketintel.gardiner.com/"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            marketintel.gardiner.com
          </a>
          ). Forecasts are a guide only; individual projects vary.
        </p>
      </div>
    </div>
  );
}

/** Revision vs the previous report: icon + text, never colour alone. */
function Revision({ now, previous }: { now: number | null; previous: number | null }) {
  if (now === null || previous === null || now === previous) return null;
  const up = now > previous;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className="ml-1 inline-flex items-center text-xs font-normal text-gray-500"
      title={`Previously ${previous.toFixed(2)}%`}
    >
      <Icon size={12} aria-hidden />
      <span className="sr-only">{up ? "up" : "down"} </span>
      from {previous.toFixed(2)}
    </span>
  );
}
