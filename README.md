# Project CPD UK

UK construction **tender price inflation (TPI) forecasts**, imported from consultants'
quarterly reports, starting with Gardiner & Theobald's Tender Price Indicator.

- **Forecasts**: the latest forecast for each region, how it was revised since the
  previous report, and how each year's forecast has moved from report to report.
- **AI chat**: ask questions about the forecasts (OpenAI).
- **Admin import**: a single admin imports report PDFs (upload page or a local script).

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

The admin upload page (`/reports`) uses the same pipeline but needs a Node runtime;
it won't work on Cloudflare Workers until the PDF library is replaced (BACKLOG 1.3).

## Code map

| Path                        | What                                                          |
| --------------------------- | ------------------------------------------------------------- |
| `src/lib/tpi/gt-parser.ts`  | G&T report text → regional forecasts (pure, unit-tested)      |
| `src/lib/ingest.server.ts`  | PDF → text → forecasts → Supabase (shared by upload + script) |
| `scripts/import-reports.ts` | Local bulk import                                             |
| `src/lib/tpi.functions.ts`  | Forecast queries                                              |
| `src/lib/chat.functions.ts` | AI chat                                                       |
| `src/lib/admin.server.ts`   | Single-admin check (`ADMIN_EMAIL`, verified server-side)      |
| `src/routes/`               | Pages: dashboard, forecasts, reports, chat, login             |
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
