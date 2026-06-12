import type { PricePoint, Quote, YahooChartResult } from '../types/market'

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[]
  }
}

export async function fetchYahooChart(
  symbol: string,
  period1: number,
  period2: number
): Promise<{ points: PricePoint[]; quote: Quote | null }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d&indicators=quote&includeTimestamps=true`
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) {
    throw new Error(`Yahoo chart fetch failed for ${symbol}: ${res.status}`)
  }

  const json = (await res.json()) as YahooChartResponse
  const result = json?.chart?.result?.[0]
  if (!result) {
    return { points: [], quote: null }
  }

  const timestamps: number[] = result.timestamp || []
  const q = result.indicators?.quote?.[0] || {}
  const closes = q.close || []
  const opens = q.open || []
  const highs = q.high || []
  const lows = q.low || []
  const volumes = q.volume || []

  const points: PricePoint[] = []
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] != null) {
      points.push({
        time: timestamps[i],
        value: closes[i]!,
        close: closes[i]!,
        open: opens[i] ?? undefined,
        high: highs[i] ?? undefined,
        low: lows[i] ?? undefined,
        volume: volumes[i] ?? undefined,
      })
    }
  }

  const last = points[points.length - 1]?.value
  const first = points[0]?.value
  const quote: Quote | null = last
    ? {
        price: last,
        change: first && last ? ((last - first) / first) * 100 : 0,
      }
    : null

  return { points, quote }
}