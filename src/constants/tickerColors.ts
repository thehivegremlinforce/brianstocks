/** Distinct colors readable on #0a0a0a chart background */
const PALETTE = [
  '#67e8f9', // cyan
  '#a3e635', // lime
  '#f472b6', // pink
  '#60a5fa', // blue
  '#fbbf24', // amber
  '#c084fc', // purple
  '#4ade80', // green
  '#f87171', // red
  '#fb923c', // orange
  '#e879f9', // fuchsia
  '#2dd4bf', // teal
  '#a78bfa', // violet
  '#facc15', // yellow
  '#38bdf8', // sky
  '#fb7185', // rose
] as const

export const TICKER_COLORS: Record<string, string> = {
  NVDA: '#67e8f9',
  AAPL: '#a3e635',
  TSLA: '#f472b6',
  META: '#60a5fa',
  AMZN: '#fbbf24',
  GOOGL: '#c084fc',
  MSFT: '#4ade80',
  AMD: '#f87171',
  AVGO: '#38bdf8',
  SMCI: '#fb923c',
  CRM: '#e879f9',
  SPY: '#facc15',
  QQQ: '#2dd4bf',
  INTC: '#a78bfa',
}

function hashTicker(ticker: string): number {
  const t = ticker.toUpperCase()
  let h = 0
  for (let i = 0; i < t.length; i++) {
    h = (h * 31 + t.charCodeAt(i)) >>> 0
  }
  return h
}

export function getTickerColor(ticker: string): string {
  const key = ticker.toUpperCase()
  if (TICKER_COLORS[key]) return TICKER_COLORS[key]
  return PALETTE[hashTicker(key) % PALETTE.length]
}

/** Stable colors for an ordered watchlist — avoids hash collisions within one session */
export function getWatchlistColors(tickers: string[]): Record<string, string> {
  const used = new Set<string>()
  const out: Record<string, string> = {}

  for (const ticker of tickers) {
    const key = ticker.toUpperCase()
    let color = TICKER_COLORS[key]
    if (!color || used.has(color)) {
      const start = hashTicker(key) % PALETTE.length
      for (let i = 0; i < PALETTE.length; i++) {
        const candidate = PALETTE[(start + i) % PALETTE.length]
        if (!used.has(candidate)) {
          color = candidate
          break
        }
      }
      color = color ?? PALETTE[start]
    }
    used.add(color)
    out[key] = color
  }

  return out
}