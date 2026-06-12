import type {
  EarningItem,
  FinnhubCandleResponse,
  NewsItem,
  PricePoint,
  Quote,
} from '../types/market'

const BASE_URL = 'https://finnhub.io/api/v1'

export async function batchFetch<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency = 5
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(fn))
    results.push(...batchResults)
  }
  return results
}

export async function fetchCandle(
  symbol: string,
  from: number,
  to: number,
  token: string
): Promise<PricePoint[]> {
  const url = `${BASE_URL}/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${token}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Finnhub candle fetch failed for ${symbol}: ${res.status}`)
  }

  const data = (await res.json()) as FinnhubCandleResponse
  if (!data || data.s !== 'ok' || !Array.isArray(data.t)) {
    return []
  }

  const points: PricePoint[] = []
  for (let i = 0; i < data.t.length; i++) {
    if (data.c?.[i] != null) {
      points.push({
        time: data.t[i],
        value: data.c[i]!,
        close: data.c[i]!,
        open: Array.isArray(data.o) ? data.o[i] : undefined,
        high: Array.isArray(data.h) ? data.h[i] : undefined,
        low: Array.isArray(data.l) ? data.l[i] : undefined,
        volume: Array.isArray(data.v) ? data.v[i] : undefined,
      })
    }
  }
  return points
}

export async function fetchQuote(symbol: string, token: string): Promise<Quote | null> {
  const url = `${BASE_URL}/quote?symbol=${symbol}&token=${token}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Finnhub quote fetch failed for ${symbol}: ${res.status}`)
  }

  const q = (await res.json()) as { c?: number; dp?: number }
  if (q && typeof q.c === 'number') {
    return { price: q.c, change: q.dp || 0 }
  }
  return null
}

export async function fetchCompanyNews(
  symbol: string,
  from: string,
  to: string,
  token: string
): Promise<NewsItem[]> {
  const url = `${BASE_URL}/company-news?symbol=${symbol}&from=${from}&to=${to}&token=${token}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Finnhub company news fetch failed for ${symbol}: ${res.status}`)
  }

  const data = (await res.json()) as NewsItem[]
  if (!Array.isArray(data)) return []
  return data.slice(0, 4).map((n) => ({ ...n, ticker: symbol }))
}

export async function fetchEarnings(symbol: string, token: string): Promise<EarningItem[]> {
  const url = `${BASE_URL}/stock/earnings?symbol=${symbol}&token=${token}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Finnhub earnings fetch failed for ${symbol}: ${res.status}`)
  }

  const data = (await res.json()) as EarningItem[]
  if (!Array.isArray(data)) return []
  return data.slice(0, 2).map((e) => ({ ...e, ticker: symbol }))
}

export async function fetchMarketNews(token: string): Promise<NewsItem[]> {
  const url = `${BASE_URL}/news?category=general&token=${token}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Finnhub market news fetch failed: ${res.status}`)
  }

  const data = (await res.json()) as NewsItem[]
  if (!Array.isArray(data)) return []
  return data.slice(0, 5).map((n) => ({ ...n, ticker: 'MKT' }))
}