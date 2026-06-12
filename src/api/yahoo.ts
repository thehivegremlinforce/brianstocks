import type { PricePoint, Quote, YahooChartResult } from '../types/market'

interface YahooChartResponse {
  chart?: {
    result?: YahooChartResult[]
  }
}

function parseYahooChartJson(json: YahooChartResponse): { points: PricePoint[]; quote: Quote | null } {
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

async function fetchYahooChartRaw(
  symbol: string,
  period1: number,
  period2: number,
  viaProxy: boolean,
  interval = '1d'
): Promise<YahooChartResponse> {
  const qs = `period1=${period1}&period2=${period2}&interval=${interval}&indicators=quote&includeTimestamps=true`
  const url = viaProxy
    ? `/api/yahoo-chart?symbol=${encodeURIComponent(symbol)}&${qs}`
    : `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?${qs}`

  const res = await fetch(url, viaProxy ? undefined : { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) {
    throw new Error(`Yahoo chart fetch failed for ${symbol}: ${res.status}`)
  }
  return (await res.json()) as YahooChartResponse
}

export async function fetchYahooChart(
  symbol: string,
  period1: number,
  period2: number,
  interval = '1d'
): Promise<{ points: PricePoint[]; quote: Quote | null }> {
  try {
    const json = await fetchYahooChartRaw(symbol, period1, period2, false, interval)
    const parsed = parseYahooChartJson(json)
    if (parsed.points.length > 0) return parsed
  } catch {
    console.warn('Direct Yahoo fetch failed for', symbol, '— trying proxy')
  }

  const json = await fetchYahooChartRaw(symbol, period1, period2, true, interval)
  return parseYahooChartJson(json)
}