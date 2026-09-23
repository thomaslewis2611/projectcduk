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
import PageHeader from "@/components/PageHeader";

export const Route = createFileRoute("/forecasts")({
  component: ForecastsPage,
});

// Brand-family categorical palette in fixed order: leaf, blue, amber, violet.
// Validated: CVD-safe and >= 3:1 against white. Lines are also direct-labelled,
// and the table below carries every value.
const SERIES_COLORS = ["#00814e", "#0d5ca9", "#bf6e00", "#764aa7"];
const AXIS = { fontSize: 12, fill: "#535d53", fontFamily: "Hanken Grotesk, sans-serif" };

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

  if (loading || !latest) {
    return (
      <>
        <PageHeader eyebrow="Forecasts" title="Tender price inflation forecasts" />
        <div className="page">
          <div className="card text-center py-12">
            <TrendingUp size={40} className="mx-auto text-line mb-4" />
            <p className="text-muted">
              {loading
                ? "Loading forecasts…"
                : "No forecasts yet. Import reports to see them here."}
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Forecasts" title="Tender price inflation forecasts">
        Forecast annual % change in UK construction tender prices (January–December), by region.
        Averages across all sectors and project sizes.
      </PageHeader>

      <div className="page space-y-6">
        <div className="card">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
            <div>
              <p className="eyebrow">Revisions</p>
              <h2 className="display text-2xl mt-1">How the forecasts have moved — {region}</h2>
            </div>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="input w-auto"
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
                <CartesianGrid stroke="#dde5dd" vertical={false} />
                <XAxis dataKey="period" tick={AXIS} stroke="#dde5dd" />
                <YAxis
                  ticks={yTicks}
                  domain={[0, yTicks[yTicks.length - 1]]}
                  tickFormatter={(v: number) => `${v}%`}
                  tick={AXIS}
                  stroke="#dde5dd"
                  width={52}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [pct(value), `${name} forecast`]}
                  contentStyle={{ borderRadius: 12, borderColor: "#dde5dd", fontSize: 13 }}
                />
                <Legend
                  formatter={(value) => <span className="text-muted text-sm">{value}</span>}
                />
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
                          fontFamily="Hanken Grotesk, sans-serif"
                          fill="#0b0d0b"
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
          <p className="text-xs text-muted mt-3">
            Each line is one calendar year; each point is what that report forecast for it.
          </p>
        </div>

        <div className="card overflow-x-auto">
          <p className="eyebrow">Latest</p>
          <h2 className="display text-2xl mt-1 mb-1">Latest forecasts</h2>
          <p className="text-sm text-muted mb-6">
            {publisher} {latest.label}. Arrows show the change from the previous report.
          </p>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.12em] text-muted border-b border-line">
                <th className="py-2 pr-4">Region</th>
                {latestYears.map((y) => (
                  <th key={y} className="py-2 px-3 text-right">
                    {y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {GT_REGIONS.map((r) => (
                <tr key={r} className={r === "UK Average" ? "font-semibold bg-paper" : undefined}>
                  <td className="py-3 pr-4">{r}</td>
                  {latestYears.map((y) => {
                    const cell = latestRows.find(
                      (row) => row.region === r && row.forecast_year === y,
                    );
                    return (
                      <td key={y} className="py-3 px-3 text-right num whitespace-nowrap">
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
          <p className="text-xs text-muted mt-6">
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
    </>
  );
}

/** Revision vs the previous report: icon + text, never colour alone. */
function Revision({ now, previous }: { now: number | null; previous: number | null }) {
  if (now === null || previous === null || now === previous) return null;
  const up = now > previous;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span
      className="ml-1.5 inline-flex items-center text-xs font-normal text-muted"
      title={`Previously ${previous.toFixed(2)}%`}
    >
      <Icon size={12} aria-hidden />
      <span className="sr-only">{up ? "up" : "down"} </span>
      from {previous.toFixed(2)}
    </span>
  );
}
