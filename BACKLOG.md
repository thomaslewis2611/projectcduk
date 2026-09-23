# Backlog — Project CD UK

_Last reviewed: 2026-09-23 (review of `bc138fd`, initial Warp/poolside build)_

## Where the build is today

A TanStack Start + Supabase + Cloudflare Workers app for turning UK construction
price-index PDF reports into queryable data, with pages for a dashboard, reports,
charts, comparison, and AI chat. ~2.4k lines.

**It looks complete but the core pipeline does not work end-to-end yet.**

| Check (at review) | Result                                                                |
| ----------------- | --------------------------------------------------------------------- |
| `npm ci`          | ✅                                                                    |
| `lint`            | ✅                                                                    |
| `build`           | ✅ (Vite doesn't typecheck)                                           |
| `typecheck`       | ❌ 27 errors at review time — several are real runtime bugs           |
| tests             | ❌ none (`test:security` points at a `tests/` dir that doesn't exist) |

### Key findings

**Security (public repo, no auth)**

- No authentication anywhere. `uploadAndParseReport` and `deleteReport` run with the
  Supabase **service-role** key, so anyone who finds the URL can upload or wipe data.
- No Row Level Security on any table. With the publishable key shipped to the
  browser (`VITE_SUPABASE_*`), anyone can read/write every table directly via PostgREST.
- `reports` storage bucket is `public = true`. Uploaded source PDFs are world-readable.
- `.env` is committed and not in `.gitignore` (values are empty today, luckily).
- Upload filename is used unsanitised as a storage key.

**Ingestion pipeline (the core of the product)**

- `upsertPriceIndex(dp)` is called without `report_id` → every insert violates
  `NOT NULL`, and errors are never checked. **Zero data points are ever stored**,
  yet the report is marked `completed`.
- Row parser is generic heuristics (first number = index, second = £/sqft); not
  written against any real report layout.
- `pdf-parse` is Node-only; it will not run on Cloudflare Workers (the deploy target).
- `result.numpdf` typo (should be `numpages`).
- Re-uploading a filename that exists fails the insert, then the error handler
  marks the **original** report as `failed`.
- Lookup tables are re-upserted row-by-row on every upload (~35 round trips), and
  each data point does 3 lookups + 1 upsert.
- Unique key `(report_id, region_id, building_type_id, size_band_id)` includes nullable
  columns; Postgres treats NULLs as distinct, so dedupe doesn't work.

**Data queries**

- `.order("reports.year")` on the parent table isn't valid PostgREST ordering.
- `ilike` filters on embedded tables without `!inner` don't filter parent rows.
- `report_id` read from `row.reports.id`, which isn't selected → always `0`.
- `deleteReport` fails once a report has data (FK has no `ON DELETE CASCADE`).
- Dashboard fetches up to 10,000 rows just to count them.

**AI chat**

- Dumps the **entire** `price_indices` table into the prompt on every message; won't scale.
- Anthropic call is missing the `anthropic-version` header and uses a retired model id
  → always fails and silently falls back to keyword search.
- Rate-limit KV binding declared but unused; its `id` is a placeholder so
  `wrangler deploy` will fail. `ai` / `@ai-sdk/openai` installed but unused.
- Quarter is stored as `"Q3 2024"` and then printed as `"Q3 2024 2024"`.

**Hygiene**

- `src/integrations/supabase/types.ts` hand-written and missing `Relationships` →
  typed client resolved to `never`, which is what hid most of the bugs above.
- README describes folders that don't exist (`components/ui`, `routes/api`, `assets/`).
- Workers env vars read via `process.env`/`globalThis`; `cloudflare-env.ts` exists but is unused.
- Placeholder `supabase/config.toml` (anon key `"your-anon-key"`, duplicate `port`).

---

## Backlog

Priority: **P0** blocks anything useful · **P1** needed for a real v1 · **P2** later.
Status: ☐ todo · ◐ in progress · ☑ done

### Phase 0 — Make it safe and make it correct

| #   | Item                                                                                                                                                                                                 | P   | Status                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --------------------- |
| 0.1 | Gitignore + untrack `.env`                                                                                                                                                                           | P0  | ☑                     |
| 0.2 | Fix Supabase `types.ts` (add `Relationships`)                                                                                                                                                        | P0  | ☑                     |
| 0.3 | Get `typecheck` to zero errors; add it to CI                                                                                                                                                         | P0  | ☑                     |
| 0.4 | Migration 002: enable RLS (public read-only on reference/price data; no anon writes), private storage bucket, `ON DELETE CASCADE`, `NULLS NOT DISTINCT` unique key, flat `price_index_rows` view     | P0  | ☑ applied to Supabase |
| 0.5 | Fix ingestion bugs: pass `report_id`, check every Supabase error, honest status (`completed` / `no_data` / `failed`), duplicate-filename handling, sanitise storage key, `numpages`, batched inserts | P0  | ☑                     |
| 0.6 | Fix query bugs in `data.functions.ts` (ordering, filters, `report_id`, count query) and chart filters                                                                                                | P0  | ☑                     |
| 0.7 | Admin auth: gate upload/delete behind Supabase Auth (single admin via `ADMIN_EMAIL`, verified server-side)                                                                                           | P0  | ☑                     |
| 0.8 | GitHub Actions CI: install, lint, format, build, typecheck, test                                                                                                                                     | P0  | ☑                     |
| 0.9 | Unit tests for PDF text extraction (fixed 3 parser bugs they exposed)                                                                                                                                | P0  | ☑                     |

### Phase 1 — Real data in

| #    | Item                                                                                                                               | P   | Status                                                                                                 |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------------ |
| 1.1  | Confirm source report(s) and licensing                                                                                             | P0  | ☑ free consultant reports; G&T TPI first; credit the source on-page                                    |
| 1.2  | G&T TPI parser (regional forecast table) with fixture tests for every layout seen 2021–2026                                        | P0  | ☑                                                                                                      |
| 1.2a | Schema for TPI forecasts (`tpi_forecasts`, `tpi_forecast_rows` view, one report per publisher+period)                              | P0  | ☑ migration 003, tested on Postgres 16                                                                 |
| 1.2b | Fix PDF text extraction running table cells together (custom pdf-parse page renderer)                                              | P0  | ☑                                                                                                      |
| 1.2c | Local import script with `--dry-run` / `--dump-text`                                                                               | P0  | ☑ all 19 G&T reports (Q4 2021 → Autumn 2026) imported, 12/12 regions each                              |
| 1.3  | Bring back admin web upload on Workers                                                                                             | P1  | ☐ web upload removed for the Workers deploy; re-add with a Workers-compatible extractor (e.g. `unpdf`) |
| 1.4  | Ingestion preview: show extracted rows for review before committing                                                                | P1  | ☐                                                                                                      |
| 1.5  | G&T "comparison of published forecasts" table (BCIS, AECOM, Arcadis) as extra series                                               | P2  | ☐                                                                                                      |
| 1.6  | Move upload to direct-to-Storage signed URL (no base64 through the Worker)                                                         | P1  | ☐                                                                                                      |
| 1.7  | Parsers for other consultants' reports (as they're added)                                                                          | P1  | ☐ _needs sample PDFs_                                                                                  |
| 1.8  | Decide the fate of the building type × size band × £/sqft model (dashboard, compare, charts pages) — no current source provides it | P1  | ☑ removed — site is TPI-only (migration 004 drops the tables)                                          |

### Phase 2 — Useful product

| #   | Item                                                                                                                     | P   | Status                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------ | --- | ----------------------------------------------------------------------------------------------- |
| 2.0 | Forecasts page: latest regional table with revisions + "how the forecasts moved" chart                                   | P0  | ☑                                                                                               |
| 2.1 | AI chat over the forecasts                                                                                               | P2  | ⏸ parked — removed for now; restore from commit `079a7d5` (OpenAI, `src/lib/chat.functions.ts`) |
| 2.2 | Chat rate limiting (if chat returns)                                                                                     | P2  | ⏸ parked with 2.1                                                                               |
| 2.3 | Dashboard/charts/compare rework around TPI data                                                                          | P1  | ☑ dashboard rebuilt around TPI; compare/charts pages removed                                    |
| 2.4 | Escalation calculator: cost × region × base quarter → target quarter, compounding annual rates by quarter; shareable URL | P1  | ☑ `/calculator`                                                                                 |
| 2.5 | CSV export of any filtered view                                                                                          | P2  | ☐                                                                                               |
| 2.6 | Supplement with open data (ONS construction output & price indices)                                                      | P2  | ☐                                                                                               |

### Phase 3 — Ship it

| #   | Item                                                                                      | P   | Status                                                                                                  |
| --- | ----------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------------- |
| 3.1 | Cloudflare deploy                                                                         | P1  | ☑ `npm run deploy` + `deploy:secrets`; unused KV binding removed; verified in the local Workers runtime |
| 3.2 | Preview deploys per PR                                                                    | P2  | ☐                                                                                                       |
| 3.3 | Error monitoring + structured logs                                                        | P2  | ☐                                                                                                       |
| 3.4 | README rewrite to match reality                                                           | P1  | ☑                                                                                                       |
| 3.5 | Remove unused code/deps: `cloudflare-env.ts`, `ai`, `@ai-sdk/openai`                      | P2  | ☑ also removed date-fns, react-markdown, sonner, clsx, tailwind-merge                                   |
| 3.6 | Fixed: site was unstyled (`border-border` broke Tailwind; stylesheet linked as `file://`) | P0  | ☑                                                                                                       |

---

## Progress log

- **2026-09-23**: Phase 0 items 0.1–0.6, 0.8 and 0.9 done. Typecheck 27 → 0 errors; 16 unit tests; CI added.
  Blocked on decisions: 0.7 (auth), 1.1/1.2 (data source + sample PDFs), 2.1 (AI provider).
- **2026-09-23 (pm)**: Source = Gardiner & Theobald TPI reports (19, Q4 2021 → Autumn 2026). Parser,
  schema, import script, Forecasts page, admin auth, OpenAI-only chat. 45 tests. First real run of the
  app found and fixed the missing styling.
- **2026-09-23 (late)**: Removed the building type / £ per sqft model (pages, server functions,
  generic parser, tables). Dashboard rebuilt around TPI. README rewritten.

- **2026-09-23 (eve)**: Supabase project set up (migrations 001–004 applied), all 19 reports
  imported, site running locally with admin sign-in. Chat parked. CSRF protection added.

- **2026-09-23 (night)**: PR #1 opened to merge into `main`. Escalation calculator added.

- **2026-09-23 (late night)**: Made the site deployable to Cloudflare Workers (read-only; imports stay
  local). Verified every page in the local Workers runtime.

## Open questions (owner: Thomas)

1. ~~Data source & licensing~~ — free consultant reports (G&T first). Pages credit the source.
2. ~~Who uploads?~~ — single admin for now.
3. **Who is it for, and is it paid?** Affects rate limits and chat cost.
4. ~~AI provider~~ — chat parked for now (was OpenAI).
5. ~~Building types / £ per sqft~~ — removed; the site is TPI-focused.
6. **Which other consultants' reports** should be added next?

## Running the import (locally)

```bash
cp .env.example .env               # fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npx supabase db push               # applies migrations 002–004
npm run import-reports -- ~/path/to/projectcduk-reports --dry-run
npm run import-reports -- ~/path/to/projectcduk-reports
```
