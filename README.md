# Pricemark

UK construction **tender price inflation (TPI) forecasts**, imported from consultants'
quarterly reports, starting with Gardiner & Theobald's Tender Price Indicator.

- **Escalation calculator**: move a cost between quarters by region, with the working shown.
- **Forecasts**: the latest forecast for each region, how it was revised since the
  previous report, and how each year's forecast has moved from report to report.
- **Admin import**: a single admin imports report PDFs with a local script.

See [BACKLOG.md](BACKLOG.md) for status and next steps.

## Stack

TanStack Start (React 19, SSR) · Supabase (Postgres, Auth, Storage) · Cloudflare Workers ·
Tailwind CSS v4 · Recharts · Vitest

## Setup

Requires Node 22+ and a Supabase project.

```bash
npm install
cp .env.example .env        # fill in the values — see comments in the file
npx supabase db push        # apply migrations in supabase/migrations/
npm run dev                 # http://localhost:3000
```

In Supabase → Authentication, create the admin user (the email in `ADMIN_EMAIL`) and
turn off public sign-ups.

## Importing reports

```bash
npm run import-reports -- <folder-of-pdfs> --dry-run    # parse only; prints what was found
npm run import-reports -- <folder-of-pdfs>              # parse and save
npm run import-reports -- <folder-of-pdfs> --dump-text  # also save extracted text to import-debug/
```

Each report is stored once per publisher and period; delete a report to re-import it.
PDFs that aren't a supported layout are rejected with a message.

Reports are imported from your computer with this script; the website itself is
read-only (the admin can delete reports on `/reports`). Web upload will come back once
PDF extraction runs on Cloudflare Workers (BACKLOG 1.3).

## Deploying (Cloudflare Workers)

**Automatic:** every merge to `main` deploys, after lint, typecheck, build and tests pass
(`.github/workflows/ci.yml`). It needs four repository secrets (GitHub → Settings → Secrets
and variables → Actions): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. To redeploy without a change, use
**Run workflow** on the CI workflow's Actions page.

**Manual**, from your computer:

```bash
npx wrangler login          # once
npm run deploy              # checks .env, builds (bakes in the VITE_* values), deploys
npm run deploy:secrets      # once, and after changing them: copies SUPABASE_URL,
                            # SUPABASE_SERVICE_ROLE_KEY and ADMIN_EMAIL from .env
```

Both commands stop with a message if a value is missing (from `.env`, or the environment in CI).

Server-side values (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`) are Worker
secrets: set them once with `npm run deploy:secrets`; they persist across deploys.

The site is served at `https://projectcduk.<your-subdomain>.workers.dev`.

## Code map

| Path                        | What                                                          |
| --------------------------- | ------------------------------------------------------------- |
| `src/lib/tpi/gt-parser.ts`  | G&T report text → regional forecasts (pure, unit-tested)      |
| `src/lib/ingest.server.ts`  | PDF → text → forecasts → Supabase (used by the import script) |
| `scripts/import-reports.ts` | Local bulk import                                             |
| `src/lib/tpi.functions.ts`  | Forecast queries                                              |
| `src/lib/tpi/escalation.ts` | Escalation maths (pure, unit-tested)                          |
| `src/lib/admin.server.ts`   | Single-admin check (`ADMIN_EMAIL`, verified server-side)      |
| `src/routes/`               | Pages: dashboard, forecasts, calculator, reports, login       |
| `supabase/migrations/`      | Schema, row-level security, views                             |

## Checks

```bash
npm run lint && npm run build && npm run typecheck && npm test
```

The build generates `src/routeTree.gen.ts`, which the typecheck needs. CI runs the same
steps (`.github/workflows/ci.yml`).

## Data

Forecasts are published by the consultants named on each page and are credited there.
They are averages across sectors and project sizes and are a guide only.
