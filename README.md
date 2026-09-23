# Project CPD UK

**UK Construction Price Index analysis tool & web application.**

A full-stack React application for ingesting, analysing, and comparing UK
construction price data extracted from PDF reports (starting 2021). The tool
supports an AI-powered chat interface for natural-language queries about build
costs, price trends, and regional comparisons.

Built on the same stack as [vett](https://github.com/thomaslewis2611/vett):
**TanStack Start** (full-stack React framework), **Supabase** (PostgreSQL),
**Cloudflare Workers** (edge deployment), **Tailwind CSS v4**, and the
**Vercel AI SDK**.

---

## Architecture

```
projectcduk/
├── src/
│   ├── start.ts              # TanStack Start entry (middleware config)
│   ├── server.ts             # Cloudflare Workers SSR entry
│   ├── router.tsx            # Router configuration
│   ├── styles.css            # Tailwind CSS v4 with @theme
│   ├── routeTree.gen.ts      # Auto-generated route tree
│   ├── index.html            # Entry HTML (SSR-injected by framework)
│   ├── assets/               # Static assets (favicon, etc.)
│   ├── components/
│   │   ├── Header.tsx        # Top navigation
│   │   ├── Footer.tsx        # Site footer
│   │   ├── StatusBadge.tsx   # Report status indicator
│   │   ├── ReportUploader.tsx # PDF upload + processing
│   │   ├── IndexChart.tsx    # Recharts trend chart
│   │   ├── IndexDataTable.tsx # Searchable data table
│   │   ├── ChatInterface.tsx # AI chat UI
│   │   └── ui/               # Shadcn-style UI primitives
│   ├── routes/               # File-based routes (TanStack Router)
│   │   ├── __root.tsx        # HTML shell, layout, error pages
│   │   ├── index.tsx         # Dashboard
│   │   ├── reports.tsx       # Reports management
│   │   ├── compare.tsx       # Compare (chart + table)
│   │   ├── charts.tsx        # Charts page
│   │   ├── chat.tsx          # AI chat page
│   │   └── api/              # Server-side API routes
│   ├── lib/
│   │   ├── utils.ts          # cn() utility
│   │   ├── cloudflare-env.ts # Cloudflare environment access
│   │   ├── error-page.ts     # Error page renderer
│   │   ├── data.functions.ts # Server functions: Supabase data queries
│   │   ├── pdf-parser.ts     # Server functions: PDF ingestion & parsing
│   │   └── chat.functions.ts # Server functions: AI chat
│   └── integrations/
│       └── supabase/
│           ├── client.ts       # Client-side Supabase client
│           ├── client.server.ts # Server-side admin client
│           └── types.ts        # TypeScript types for DB schema
├── supabase/
│   ├── config.toml            # Supabase local config
│   └── migrations/            # Database migrations
├── wrangler.jsonc             # Cloudflare Workers deployment config
├── package.json
├── tsconfig.json
├── vite.config.ts             # Vite + TanStack Start + Cloudflare plugin
├── eslint.config.js
├── .prettierrc
├── .env.example
└── README.md
```

---

## Tech Stack

| Layer       | Technology                                         |
|-------------|----------------------------------------------------|
| Framework   | TanStack Start 1.x (React 19, SSR/SSG)             |
| Routing     | TanStack Router (file-based)                       |
| Data Fetching | TanStack Query + Server Functions               |
| Database    | Supabase (PostgreSQL)                              |
| Charts      | Recharts                                           |
| Styling     | Tailwind CSS v4 via `@tailwindcss/vite`            |
| Icons       | Lucide React                                       |
| Validation  | Zod                                                |
| AI Chat     | Vercel AI SDK + OpenAI / Anthropic                 |
| PDF Parsing | `pdf-parse` (server-side)                          |
| Deployment  | Cloudflare Workers (`wrangler`)                    |
| Lint/Format | ESLint + Prettier                                 |

---

## Quick Start

### Prerequisites
- Node.js 20+
- npm (or pnpm/bun)
- A Supabase project (free tier works)
- Cloudflare account (for deployment)
- OpenAI or Anthropic API key (for AI chat, optional)

### 1. Clone the repository

```bash
git clone https://github.com/thomaslewis2611/projectcduk.git
cd projectcduk
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key from the Project Settings → API
3. Get your service role key (Project Settings → API → service_role)
4. Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

5. Apply the database migrations:

```bash
npx supabase db push
```

### 4. Start the dev server

```bash
npm run dev
```

Open `http://localhost:3000` — the app runs with full SSR via Vite.

### 5. Upload PDF reports

1. Go to `http://localhost:3000/reports`
2. Click "Upload" and select a PDF price index report
3. The system extracts data points into the Supabase database
4. Navigate to Dashboard, Charts, or Compare to see the data

---

## API Endpoints (Server Functions)

Server functions are defined in `src/lib/` and called directly from the client
(TanStack Start handles the client-server boundary automatically).

| Function                 | File              | Description                              |
|--------------------------|-------------------|------------------------------------------|
| `fetchReports()`         | `data.functions.ts` | List all uploaded reports               |
| `fetchIndices()`         | `data.functions.ts` | Query price indices with filters         |
| `fetchComparison()`      | `data.functions.ts` | Time-ordered comparison for charts       |
| `fetchRegions()`         | `data.functions.ts` | List all regions                        |
| `fetchBuildingTypes()`   | `data.functions.ts` | List all building types                 |
| `fetchSizeBands()`       | `data.functions.ts` | List all size bands                     |
| `fetchYears()`           | `data.functions.ts` | List available years                    |
| `fetchQuarters()`        | `data.functions.ts` | List available quarters                 |
| `deleteReport()`         | `data.functions.ts` | Delete a report and its data            |
| `uploadAndParseReport()` | `pdf-parser.ts`     | Upload + parse a PDF report             |
| `chatAboutConstruction()` | `chat.functions.ts` | AI chat about construction price data   |

---

## AI Chat Feature

The AI chat (`/chat` route) lets users ask natural-language questions about
construction price data:

Examples:
- "Compare the build cost of a 150,000 sqft industrial shed from 2022 to 2026 in South West England"
- "What was the price per sqft for offices in London in Q2 2024?"
- "Show me the trend for industrial logistics sheds in the North West"

When `OPENAI_API_KEY` is set, the system queries the database for relevant data
and sends the context to OpenAI. Without a key, it falls back to keyword-based
matching against the data.

---

## Deployment (Cloudflare Workers)

```bash
npm run build
npx wrangler deploy
```

The `wrangler.jsonc` configures the Worker. In production, Supabase environment
variables should be set in the Cloudflare dashboard.

---

## Development Notes

- **Server Functions**: All server-side logic uses `createServerFn()` from
  `@tanstack/react-start`. Server-only code lives in `*.server.ts` files or
  modules imported only by server functions.
- **Import Protection**: The Vite config includes import protection that
  prevents client code from importing server-only modules.
- **PDF Parsing**: The `pdf-parse` library is dynamically imported inside the
  `uploadAndParseReport` server function to avoid bundling it for the client.
- **Route Tree**: `routeTree.gen.ts` is auto-generated by the
  `@tanstack/router-plugin`. Don't edit it.

---

## License
MIT
