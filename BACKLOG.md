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

| #   | Item                                                                                                                                                                                                 | P   | Status                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | --------------------------------------------------------------------- |
| 0.1 | Gitignore + untrack `.env`                                                                                                                                                                           | P0  | ☑                                                                     |
| 0.2 | Fix Supabase `types.ts` (add `Relationships`)                                                                                                                                                        | P0  | ☑                                                                     |
| 0.3 | Get `typecheck` to zero errors; add it to CI                                                                                                                                                         | P0  | ☑                                                                     |
| 0.4 | Migration 002: enable RLS (public read-only on reference/price data; no anon writes), private storage bucket, `ON DELETE CASCADE`, `NULLS NOT DISTINCT` unique key, flat `price_index_rows` view     | P0  | ☑ tested on Postgres 16; **not yet applied to your Supabase project** |
| 0.5 | Fix ingestion bugs: pass `report_id`, check every Supabase error, honest status (`completed` / `no_data` / `failed`), duplicate-filename handling, sanitise storage key, `numpages`, batched inserts | P0  | ☑                                                                     |
| 0.6 | Fix query bugs in `data.functions.ts` (ordering, filters, `report_id`, count query) and chart filters                                                                                                | P0  | ☑                                                                     |
| 0.7 | Admin auth: gate upload/delete behind Supabase Auth (admin role)                                                                                                                                     | P0  | ☐ _needs decision_                                                    |
| 0.8 | GitHub Actions CI: install, lint, format, build, typecheck, test                                                                                                                                     | P0  | ☑                                                                     |
| 0.9 | Unit tests for PDF text extraction (fixed 3 parser bugs they exposed)                                                                                                                                | P0  | ☑                                                                     |

### Phase 1 — Real data in

| #   | Item                                                                                                                       | P   | Status             |
| --- | -------------------------------------------------------------------------------------------------------------------------- | --- | ------------------ |
| 1.1 | Confirm source report(s) and licensing (see Open questions)                                                                | P0  | ☐ _needs decision_ |
| 1.2 | Get 2–3 real sample PDFs; write a parser **per report format** with fixture tests                                          | P0  | ☐                  |
| 1.3 | Swap `pdf-parse` for a Workers-compatible extractor (`unpdf`/pdfjs), or move ingestion to a Supabase Edge Function / queue | P1  | ☐                  |
| 1.4 | Ingestion preview: show extracted rows for review before committing                                                        | P1  | ☐                  |
| 1.5 | Seed lookup tables in a migration instead of per-upload (now 3 bulk upserts, was ~35 calls)                                | P2  | ☐                  |
| 1.6 | Move upload to direct-to-Storage signed URL (no base64 through the Worker)                                                 | P1  | ☐                  |
| 1.7 | Store quarter as `year` + `quarter smallint`; proper `report_date date`                                                    | P1  | ☐                  |

### Phase 2 — Useful product

| #   | Item                                                                                                                                         | P   | Status |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------ |
| 2.1 | Chat: replace "dump whole DB" with tool calls (`query_indices(region, type, size, period)`); one provider via AI SDK; current model ids      | P1  | ☐      |
| 2.2 | Chat rate limiting (real KV namespace) + request size limits                                                                                 | P1  | ☐      |
| 2.3 | Charts/compare: move to TanStack Query loaders, URL-driven filters (shareable links); stop plotting index values and £/sqft on the same axis | P1  | ☐      |
| 2.4 | Cost calculator: "X sqft of type Y in region Z, then vs now" with index-adjusted £                                                           | P1  | ☐      |
| 2.5 | CSV export of any filtered view                                                                                                              | P2  | ☐      |
| 2.6 | Supplement with open data (ONS construction output & price indices)                                                                          | P2  | ☐      |

### Phase 3 — Ship it

| #   | Item                                                                                              | P   | Status |
| --- | ------------------------------------------------------------------------------------------------- | --- | ------ |
| 3.1 | Cloudflare deploy: real KV id, secrets via `wrangler secret`, env via Workers bindings            | P1  | ☐      |
| 3.2 | Preview deploys per PR                                                                            | P2  | ☐      |
| 3.3 | Error monitoring + structured logs                                                                | P2  | ☐      |
| 3.4 | README rewrite to match reality                                                                   | P1  | ☐      |
| 3.5 | Remove unused code/deps: `cloudflare-env.ts`, `ai`, `@ai-sdk/openai` (after 2.1 decides provider) | P2  | ☐      |

---

## Progress log

- **2026-09-23**: Phase 0 items 0.1–0.6, 0.8 and 0.9 done. Typecheck 27 → 0 errors; 16 unit tests; CI added.
  Blocked on decisions: 0.7 (auth), 1.1/1.2 (data source + sample PDFs), 2.1 (AI provider).

## Open questions (owner: Thomas)

1. **Data source & licensing.** Which report(s) are the PDFs from (BCIS, RICS, a
   QS firm's quarterly report, your own)? If it's paid data, republishing figures
   publicly may breach its licence. This decides whether the site is public or private.
2. **Who uploads?** Just you (single admin), or several users with their own data?
3. **Who is it for, and is it paid?** It affects auth, rate limits and chat cost.
4. **AI provider.** OpenAI or Anthropic? The code tries both; picking one simplifies things.
5. **Sample PDFs.** Can you add 2–3 real reports (privately, not in this public repo)?
