import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { fetchReports, type Report } from "@/lib/data.functions";
import { fetchTpiForecasts, type TpiForecastRow } from "@/lib/tpi.functions";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
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
    <>
      {/* Hero */}
      <section className="band">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="frame px-6 sm:px-10 pt-20 pb-16 sm:pt-28 text-center">
            <p className="text-base text-lime/80 mb-6">UK tender price intelligence</p>
            <h1 className="display text-5xl sm:text-6xl lg:text-7xl text-lime max-w-5xl mx-auto leading-[1.05]">
              Know where construction prices are heading.
            </h1>
            <p className="mt-6 text-lg text-lime/75 max-w-2xl mx-auto">
              Regional tender price inflation forecasts from leading UK cost consultants, tracked
              report by report — with an escalation calculator built in.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Link to="/calculator" className="btn btn-lime">
                Escalate a cost <ArrowRight size={16} />
              </Link>
              <Link to="/forecasts" className="btn btn-outline-light">
                View forecasts
              </Link>
            </div>

            {/* Headline figures */}
            <div className="mt-16 rounded-2xl bg-white text-ink text-left shadow-[0_24px_60px_-20px_rgb(0_0_0/0.45)] overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line px-6 py-3">
                <span className="eyebrow">Latest forecast</span>
                <span className="text-xs text-muted">{source ?? (loading ? "Loading…" : "")}</span>
              </div>
              {loading ? (
                <p className="px-6 py-10 text-muted">Loading…</p>
              ) : !latest ? (
                <p className="px-6 py-10 text-muted">No forecasts imported yet.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-line">
                  <Figure label={`UK average, ${headlineYear}`} row={find("UK Average")} />
                  <Figure label={`Greater London, ${headlineYear}`} row={find("Greater London")} />
                  <Figure
                    label={`UK average, ${(headlineYear ?? 0) + 1}`}
                    row={latestRows.find(
                      (f) =>
                        f.region === "UK Average" && f.forecast_year === (headlineYear ?? 0) + 1,
                    )}
                  />
                  <div className="p-6">
                    <div className="num text-3xl sm:text-4xl text-ink">{reports.length}</div>
                    <p className="mt-2 text-sm text-muted">Reports tracked</p>
                    {reports.length > 0 && (
                      <p className="mt-1 text-xs text-muted">
                        since {reports[reports.length - 1].quarter}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* What it does */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-x border-line px-6 sm:px-10 py-20">
          <h2 className="display text-4xl sm:text-5xl max-w-2xl">
            One place for UK tender price forecasts
          </h2>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            <Feature
              eyebrow="Forecasts"
              title="Every region, every revision"
              to="/forecasts"
              cta="View forecasts"
            >
              The latest annual forecast for twelve UK regions, and how each year's forecast has
              moved from one report to the next.
            </Feature>
            <Feature
              eyebrow="Escalate"
              title="Move a cost through time"
              to="/calculator"
              cta="Open the calculator"
            >
              Take a budget priced in one quarter to another, by region, with every year's rate and
              its source shown.
            </Feature>
            <Feature
              eyebrow="Sources"
              title="Straight from the reports"
              to="/reports"
              cta="See the reports"
            >
              Forecasts are read directly from consultants' published reports, and every figure is
              credited to the report it came from.
            </Feature>
          </div>
        </div>
      </section>

      {/* Recent reports */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-x border-t border-line px-6 sm:px-10 py-16">
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="display text-3xl">Recent reports</h2>
            <Link to="/reports" className="text-sm text-leaf hover:underline">
              All reports
            </Link>
          </div>
          {reports.length === 0 ? (
            <p className="text-muted text-sm">
              {loading ? "Loading…" : "No reports imported yet."}
            </p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {reports.slice(0, 5).map((report) => (
                <li key={report.id} className="py-4 flex justify-between gap-4 text-sm">
                  <span>{report.title ?? report.filename}</span>
                  <span className="num text-muted whitespace-nowrap">{report.quarter}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}

function Figure({ label, row }: { label: string; row: TpiForecastRow | undefined }) {
  const now = row?.change_pct ?? null;
  const prev = row?.previous_change_pct ?? null;
  const revised = now !== null && prev !== null && now !== prev;
  const up = revised && now! > prev!;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <div className="p-5 sm:p-6">
      <div className="num text-3xl sm:text-4xl text-forest">
        {now === null ? "N/A" : `${now.toFixed(2)}%`}
      </div>
      <p className="mt-2 text-sm text-muted">{label}</p>
      <p className="mt-1 text-xs text-muted flex items-center gap-1 whitespace-nowrap">
        {revised ? (
          <>
            <Icon size={12} aria-hidden />
            {up ? "up" : "down"} from <span className="num">{prev!.toFixed(2)}%</span>
          </>
        ) : prev !== null ? (
          "unchanged"
        ) : null}
      </p>
    </div>
  );
}

function Feature({
  eyebrow,
  title,
  to,
  cta,
  children,
}: {
  eyebrow: string;
  title: string;
  to: "/forecasts" | "/calculator" | "/reports";
  cta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-l border-line pl-5">
      <p className="eyebrow">{eyebrow}</p>
      <h3 className="mt-2 text-xl">{title}</h3>
      <p className="mt-3 text-sm text-muted leading-relaxed">{children}</p>
      <Link
        to={to}
        className="mt-4 inline-flex items-center gap-1 text-sm text-leaf hover:underline"
      >
        {cta} <ArrowRight size={14} />
      </Link>
    </div>
  );
}
