import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Calculator, FileText, TrendingUp } from "lucide-react";
import { fetchReports, type Report } from "@/lib/data.functions";
import { fetchTpiForecasts, type TpiForecastRow } from "@/lib/tpi.functions";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const [reports, setReports] = React.useState<Report[]>([]);
  const [forecasts, setForecasts] = React.useState<TpiForecastRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([fetchReports(), fetchTpiForecasts()])
      .then(([r, f]) => {
        setReports(r);
        setForecasts(f);
      })
      .catch((err) => console.error("Failed to load dashboard data:", err))
      .finally(() => setLoading(false));
  }, []);

  // Forecasts arrive ordered by report period, so the last row is from the latest report.
  const latest = forecasts[forecasts.length - 1];
  const latestRows = latest
    ? forecasts.filter(
        (f) => f.period_year === latest.period_year && f.period_quarter === latest.period_quarter,
      )
    : [];
  const headlineYear = latestRows.length
    ? Math.min(...latestRows.map((f) => f.forecast_year))
    : null;
  const find = (region: string) =>
    latestRows.find((f) => f.region === region && f.forecast_year === headlineYear);
  const source = latest ? `${latest.publisher} ${latest.period_label}` : null;

  return (
    <div className="space-y-8">
      <div className="text-center py-6">
        <h1 className="text-4xl font-bold text-gradient mb-2">UK tender price inflation</h1>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto">
          Consultants' forecasts for how construction tender prices will move, by region and year,
          and how those forecasts have been revised.
        </p>
      </div>

      {loading ? (
        <p className="text-center text-gray-500">Loading…</p>
      ) : !latest ? (
        <div className="card text-center py-12">
          <TrendingUp size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No forecasts imported yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <HeadlineTile
            label={`UK average, ${headlineYear}`}
            row={find("UK Average")}
            source={source}
          />
          <HeadlineTile
            label={`Greater London, ${headlineYear}`}
            row={find("Greater London")}
            source={source}
          />
          <div className="card text-center">
            <div className="text-3xl font-bold text-gray-900">{latest.period_label}</div>
            <p className="text-sm text-gray-600 mt-1">Latest report</p>
            <p className="text-xs text-gray-500 mt-2">{latest.publisher}</p>
          </div>
          <div className="card text-center">
            <div className="text-3xl font-bold text-gray-900">{reports.length}</div>
            <p className="text-sm text-gray-600 mt-1">Reports imported</p>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Link to="/forecasts" className="card hover:border-cpi-blue transition-colors">
          <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <TrendingUp size={20} />
            Forecasts by region
          </h3>
          <p className="text-sm text-gray-600">
            The latest forecast for every region, and how each year's forecast has moved from report
            to report.
          </p>
        </Link>
        <Link to="/calculator" className="card hover:border-cpi-blue transition-colors">
          <h3 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <Calculator size={20} />
            Escalation calculator
          </h3>
          <p className="text-sm text-gray-600">
            e.g. what a £2m budget priced in Q1 2024 is likely to cost in Q4 2027, by region.
          </p>
        </Link>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <FileText size={20} />
          Recent reports
        </h3>
        {reports.length === 0 ? (
          <p className="text-gray-400 text-sm">No reports imported yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {reports.slice(0, 5).map((report) => (
              <li key={report.id} className="py-2 flex justify-between text-sm">
                <span className="text-gray-900">{report.title ?? report.filename}</span>
                <span className="text-gray-500">{report.quarter}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function HeadlineTile({
  label,
  row,
  source,
}: {
  label: string;
  row: TpiForecastRow | undefined;
  source: string | null;
}) {
  const now = row?.change_pct ?? null;
  const prev = row?.previous_change_pct ?? null;
  const revised = now !== null && prev !== null && now !== prev;
  const Icon = revised && now! > prev! ? ArrowUp : ArrowDown;
  return (
    <div className="card text-center">
      <div className="text-3xl font-bold text-cpi-blue">
        {now === null ? "N/A" : `${now.toFixed(2)}%`}
      </div>
      <p className="text-sm text-gray-600 mt-1">{label}</p>
      <p className="text-xs text-gray-500 mt-2 inline-flex items-center gap-1">
        {revised ? (
          <>
            <Icon size={12} aria-hidden />
            {now! > prev! ? "up" : "down"} from {prev!.toFixed(2)}%
          </>
        ) : prev !== null ? (
          "unchanged"
        ) : null}
      </p>
      {source && <p className="text-xs text-gray-500">{source}</p>}
    </div>
  );
}
