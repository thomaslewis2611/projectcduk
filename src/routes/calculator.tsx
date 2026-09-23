import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Calculator } from "lucide-react";
import { fetchTpiForecasts, type TpiForecastRow } from "@/lib/tpi.functions";
import { GT_REGIONS } from "@/lib/tpi/gt-parser";
import {
  bestRatesByYear,
  escalate,
  formatQuarter,
  quarterIndex,
  type Quarter,
} from "@/lib/tpi/escalation";

type Search = { amount?: number; region?: string; from?: string; to?: string };

export const Route = createFileRoute("/calculator")({
  // Inputs live in the URL so a calculation can be shared as a link.
  validateSearch: (search: Record<string, unknown>): Search => ({
    amount: Number(search.amount) > 0 ? Number(search.amount) : undefined,
    region: typeof search.region === "string" ? search.region : undefined,
    from: typeof search.from === "string" ? search.from : undefined,
    to: typeof search.to === "string" ? search.to : undefined,
  }),
  component: CalculatorPage,
});

/** "2026-3" ↔ { year: 2026, quarter: 3 } */
const quarterKey = (q: Quarter) => `${q.year}-${q.quarter}`;
function parseQuarterKey(key: string | undefined): Quarter | null {
  const m = /^(\d{4})-([1-4])$/.exec(key ?? "");
  return m ? { year: Number(m[1]), quarter: Number(m[2]) } : null;
}

const gbp = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function CalculatorPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [rows, setRows] = React.useState<TpiForecastRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [amountText, setAmountText] = React.useState(
    (search.amount ?? 1_000_000).toLocaleString("en-GB"),
  );

  React.useEffect(() => {
    fetchTpiForecasts()
      .then(setRows)
      .catch((err) => console.error("Failed to load forecasts:", err))
      .finally(() => setLoading(false));
  }, []);

  const region = GT_REGIONS.includes(search.region as (typeof GT_REGIONS)[number])
    ? (search.region as string)
    : "UK Average";
  const rates = React.useMemo(() => bestRatesByYear(rows, region), [rows, region]);
  const years = [...rates.keys()].sort((a, b) => a - b);

  // Selectable quarters: Q4 of the year before the first rate, to Q4 of the last.
  const quarterOptions: Quarter[] = [];
  if (years.length) {
    for (let y = years[0] - 1; y <= years[years.length - 1]; y++) {
      for (let q = y === years[0] - 1 ? 4 : 1; q <= 4; q++)
        quarterOptions.push({ year: y, quarter: q });
    }
  }
  const inRange = (q: Quarter | null): q is Quarter =>
    !!q && quarterOptions.some((o) => quarterIndex(o) === quarterIndex(q));

  // Defaults: from the latest report's quarter, to Q4 two years on (clamped to the data).
  const latest = rows[rows.length - 1];
  const defaultFrom: Quarter | null = latest?.period_year
    ? { year: latest.period_year, quarter: latest.period_quarter ?? 1 }
    : null;
  const defaultTo: Quarter | null = defaultFrom
    ? {
        year: Math.min(defaultFrom.year + 2, years[years.length - 1] ?? defaultFrom.year),
        quarter: 4,
      }
    : null;

  const fromQ = inRange(parseQuarterKey(search.from)) ? parseQuarterKey(search.from)! : defaultFrom;
  const toQ = inRange(parseQuarterKey(search.to)) ? parseQuarterKey(search.to)! : defaultTo;
  const amount = search.amount ?? 1_000_000;

  const update = (patch: Partial<Search>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  const result = fromQ && toQ ? escalate(amount, fromQ, toQ, rates) : null;

  if (loading) return <div className="py-12 text-center text-gray-500">Loading forecasts…</div>;
  if (!years.length || !fromQ || !toQ) {
    return (
      <div className="card text-center py-12 text-gray-500">
        No forecasts yet. Import reports to use the calculator.
      </div>
    );
  }

  const selectClass = "w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <Calculator size={24} className="text-cpi-blue" />
          Escalation calculator
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Move a construction cost from one quarter to another using tender price inflation
          forecasts.
        </p>
      </div>

      <div className="card grid gap-4 md:grid-cols-4">
        <label className="text-sm text-gray-700">
          Cost (£)
          <input
            inputMode="numeric"
            value={amountText}
            onChange={(e) => {
              setAmountText(e.target.value);
              const n = Number(e.target.value.replace(/[^\d.]/g, ""));
              if (n > 0) update({ amount: n });
            }}
            onBlur={() => setAmountText(amount.toLocaleString("en-GB"))}
            className="mt-1 w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-gray-700">
          Region
          <select
            value={region}
            onChange={(e) => update({ region: e.target.value })}
            className={`mt-1 ${selectClass}`}
          >
            {GT_REGIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-700">
          Priced at
          <select
            value={quarterKey(fromQ)}
            onChange={(e) => update({ from: e.target.value })}
            className={`mt-1 ${selectClass}`}
          >
            {quarterOptions.map((q) => (
              <option key={quarterKey(q)} value={quarterKey(q)}>
                {formatQuarter(q)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-700">
          Escalate to
          <select
            value={quarterKey(toQ)}
            onChange={(e) => update({ to: e.target.value })}
            className={`mt-1 ${selectClass}`}
          >
            {quarterOptions.map((q) => (
              <option key={quarterKey(q)} value={quarterKey(q)}>
                {formatQuarter(q)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {result && !result.ok && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {result.error}
        </div>
      )}

      {result?.ok && (
        <>
          <div className="card text-center">
            <p className="text-sm text-gray-600">
              {gbp.format(result.amount)} priced at {formatQuarter(fromQ)} is about
            </p>
            <div className="text-4xl font-bold text-cpi-blue my-2">
              {gbp.format(result.escalated)}
            </div>
            <p className="text-sm text-gray-600">
              at {formatQuarter(toQ)} in {region}:{" "}
              <span className="font-medium text-gray-900">
                {result.changePct >= 0 ? "+" : ""}
                {result.changePct.toFixed(1)}%
              </span>{" "}
              ({result.changePct >= 0 ? "+" : "−"}
              {gbp.format(Math.abs(result.escalated - result.amount))})
            </p>
          </div>

          {result.steps.length > 0 && (
            <div className="card overflow-x-auto">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">How it's worked out</h2>
              <p className="text-sm text-gray-500 mb-4">
                Each year's annual rate is spread evenly over its four quarters and compounded.
                {result.backwards &&
                  " The target is earlier than the base, so the cost is de-escalated."}
              </p>
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500">
                    <th className="py-2 pr-4">Year</th>
                    <th className="py-2 px-3 text-right">Quarters</th>
                    <th className="py-2 px-3 text-right">Annual rate</th>
                    <th className="py-2 px-3 text-right">Applied</th>
                    <th className="py-2 pl-3">Rate from</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.steps.map((s) => (
                    <tr key={s.year}>
                      <td className="py-2 pr-4 text-gray-900">{s.year}</td>
                      <td className="py-2 px-3 text-right text-gray-900">{s.quarters} of 4</td>
                      <td className="py-2 px-3 text-right text-gray-900">
                        {s.changePct.toFixed(2)}%
                      </td>
                      <td className="py-2 px-3 text-right text-gray-900">
                        {result.backwards ? "−" : "+"}
                        {((s.factor - 1) * 100).toFixed(2)}%
                      </td>
                      <td className="py-2 pl-3 text-gray-500">{s.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-gray-500">
            Past years use the last forecast made for that year; future years use the latest
            forecast. These are regional averages across all sectors and project sizes; a guide
            only, not a substitute for project-specific advice.
          </p>
        </>
      )}
    </div>
  );
}
