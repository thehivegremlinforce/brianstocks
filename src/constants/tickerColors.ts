/**
 * High-contrast colors for comparative charts on #0a0a0a.
 * Uses golden-angle hue spacing so adjacent watchlist tickers are maximally distinct.
 */

/** lightweight-charts lineStyle: 0=solid, 1=dotted, 2=dashed, 3=large dashed */
export const LINE_STYLES = [0, 2, 1, 3, 2, 0, 1, 3, 2, 1] as const

export function colorFromIndex(index: number): string {
  const hue = (index * 137.508) % 360
  // Alternate lightness so neighbors differ in brightness too
  const lightness = index % 3 === 0 ? 68 : index % 3 === 1 ? 58 : 48
  const saturation = index % 2 === 0 ? 95 : 82
  return `hsl(${hue.toFixed(1)}, ${saturation}%, ${lightness}%)`
}

export function lineStyleFromIndex(index: number): number {
  return LINE_STYLES[index % LINE_STYLES.length]
}

/** Assign colors strictly by watchlist position — best for side-by-side comparison */
export function getWatchlistColors(tickers: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  tickers.forEach((ticker, index) => {
    out[ticker.toUpperCase()] = colorFromIndex(index)
  })
  return out
}

export function getWatchlistLineStyles(tickers: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  tickers.forEach((ticker, index) => {
    out[ticker.toUpperCase()] = lineStyleFromIndex(index)
  })
  return out
}

/** @deprecated Use getWatchlistColors — kept for any external imports */
export const TICKER_COLORS: Record<string, string> = {}

export function getTickerColor(_ticker: string, index = 0): string {
  return colorFromIndex(index)
}