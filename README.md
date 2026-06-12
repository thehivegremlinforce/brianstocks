# BrianStocks

**BrianStocks** — your personal stock mission control. Select up to 10 tickers, chart up to 5 years of price history with instant range switching, and see company news, earnings, and X (Twitter) activity — all in a pure SPACEX-inspired black telemetry interface.

Zero accounts. Everything runs in your browser. Prices work immediately via public Yahoo Finance. News + earnings unlock with a free Finnhub token.

## Features
- Watchlist: add/remove up to 10 tickers (quick-add populars)
- Range presets: 1D through 5Y (enforced)
- Beautiful multi-series price chart (TradingView lightweight-charts)
  - Toggle absolute price vs % normalized to start of range
- Live(ish) quotes strip + table with deltas
- Company news + earnings (when you add your free Finnhub token)
- X trending: pre-scoped deep links to x.com with `$TICKER since:YYYY-MM-DD` for the current range
- SPACEX design language: #000 black, cyan accents, mono metrics, uppercase labels, crisp minimal panels
- Keyboard power-user controls
- Persists your watchlist + token in localStorage

## Telemetry Bar & SPACEX Aesthetic
A persistent top telemetry bar (integrated below the header) provides real-time mission control data:
- Live UTC clock (second-resolution updating)
- US Market Status: `OPEN` / `CLOSED` / `PRE` (pre-market) / `AFTER` (after-hours) — computed live from NYSE 9:30–16:00 ET hours, with correct pre/after windows and weekend handling
- Last data update timestamp (UTC from last Yahoo/Finnhub fetch)
- SIGNAL strength: green dot + `NOMINAL` (simulated but styled like flight computers)

Additional polish:
- Subtle repeating scanlines + data-readout overlays on panels/cards/chart for authentic control-screen feel
- Extra horizontal rule styling and high-density mono tabular alignment for all numeric readouts (prices, %, times)
- Preset watchlist buttons: **MAGNIFICENT 7** and **AI SEMIS** instantly load curated sets (non-destructive to max-10 limit)
- X panel now shows live-feeling "TREND SCORE" (synthetic, based on watchlist size + ticker) + relative recency ("17m ago", "3h ago")
- Improved error/empty states: e.g. "YAHOO RATE LIMITED — RETAINING CACHED / STALE", rate-limit notes on news/earnings

Desktop-first with light mobile hardening (fonts, spacing, wrap on narrow screens).

## Demo Flow (Recommended)
1. Open the app — default watchlist (NVDA, AAPL, TSLA, META) + 5Y range auto-loads via Yahoo.
2. Hit `P` (or `/`) to focus the ADD input — type `SMCI` + Enter.
3. Click **AI SEMIS** preset — instantly swaps to high-conviction semis set.
4. Use `1`–`9` keys to cycle ranges; watch the telemetry bar update LAST DATA on refresh.
5. Toggle the chart between ABSOLUTE PRICE / NORMALIZED %.
6. Open Settings (`S`) and paste a free Finnhub token to unlock news + earnings panels.
7. Click any X link — deep search scoped to ticker + range; notice the added SCORE + recency in the panel.
8. Hit `?` anytime for the full keyboard reference overlay.
9. `R` refreshes; `Cmd/Ctrl+C` clears everything. Observe market status flip PRE/OPEN/AFTER in real ET time.

Everything is client-side, zero backend, pure browser telemetry.

## Run locally

```bash
cd BrianStocks
npm install
npm run dev
```

Open http://localhost:5173

## Keyboard shortcuts
- `/` or `p` — focus the ticker add input (portfolio)
- `1`–`9` — jump to range presets (1D,5D,1M,3M,6M,YTD,1Y,2Y,5Y)
- `r` — force refresh all data
- `s` — open Settings
- `?` — open help / keyboard overlay
- `Cmd/Ctrl + C` — clear watchlist
- `ESC` — close any modal (settings/help)

## Get a free Finnhub token (for news + earnings)

1. Go to https://finnhub.io/register (free, no credit card)
2. Copy your API key
3. In BrianStocks click **SETTINGS** (top right)
4. Paste the token and hit **SAVE + REFRESH DATA**

Prices always work without a token. The token is stored only in your browser.

## Data sources
- Price history & quotes: Yahoo Finance public chart API (no key)
- News & earnings: Finnhub (free tier, 60 calls/min — generous for personal use)
- X activity: direct deep links (no API key needed)

## Deploy to Vercel (free plan, via GitHub — recommended)

Vercel has excellent zero-config support for Vite projects and the Hobby (free) tier is perfect for this personal dashboard.

1. Make sure your code is pushed to GitHub (this repo).
2. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repository `thehivegremlinforce/brianstocks`.
3. Vercel will auto-detect it as a **Vite** project:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - No extra environment variables needed (all data fetching is client-side; your Finnhub token stays in your browser's localStorage).
4. Click Deploy.

After the first deploy:
- Every push to `main` (or your default branch) will automatically trigger a new production deployment.
- Pull requests get preview deployments for free.
- Your site will be at something like `https://brianstocks-xxx.vercel.app`.

### Why this works great on free Vercel
- Pure static SPA — no serverless functions or backend required.
- All API calls (Yahoo Finance public endpoint + optional Finnhub) happen directly from the user's browser.
- No secrets or server env vars needed.
- The `vercel.json` in the repo provides explicit hints + SPA fallback (future-proof if you ever add client-side routing).

### Manual / alternative deploys
```bash
npm run build
npm run preview
```

You can also drag the `dist/` folder to Vercel, Netlify, Cloudflare Pages, GitHub Pages, etc. — it is a standard static site.

## Tech
- Vite + React 19 + TypeScript
- Tailwind v4 + custom SPACEX CSS variables
- Zustand + persist (watchlist + token)
- lightweight-charts (TradingView)
- date-fns, lucide-react, framer-motion, sonner

Built following the exact patterns from the user's other projects (AI Simulator, arcworld) but with a strict SpaceX telemetry aesthetic.

## Tech
- Vite + React 19 + TypeScript
- Tailwind v4 + custom SPACEX CSS variables
- Zustand + persist (watchlist + token)
- lightweight-charts (TradingView)
- date-fns, lucide-react, framer-motion, sonner

Built following the exact patterns from the user's other projects (AI Simulator, arcworld) but with a strict SpaceX telemetry aesthetic.

## Notes
- Max 5 years enforced by the UI
- All data is fetched client-side on demand
- For production trading use you would add your own brokerage keys / alerts etc. This is a personal research dashboard.

Enjoy. Fly safe.
