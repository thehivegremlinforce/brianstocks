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
}

export function getTickerColor(ticker: string): string {
  return TICKER_COLORS[ticker] ?? '#67e8f9'
}