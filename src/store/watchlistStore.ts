import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { subYears, subMonths, startOfYear, format } from 'date-fns'

export type RangePreset =
  | '1D' | '5D' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '2Y' | '5Y'

export interface PricePoint {
  time: number // unix seconds for lightweight-charts
  value: number
  // Enhanced for future use (volume + OHLC captured from Yahoo, optional to preserve compat)
  // Also 'close' alias provided for extended chart rendering (candles/vol) without breaking line chart
  close?: number
  volume?: number
  high?: number
  low?: number
  open?: number
}

interface WatchlistState {
  selected: string[]
  rangePreset: RangePreset
  customFrom?: string
  customTo?: string
  series: Record<string, PricePoint[]>
  quotes: Record<string, { price: number; change: number }>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  news: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  marketNews: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  earnings: any[]
  finnhubToken: string
  loading: boolean
  lastUpdated: number | null   // unix ms of last successful data fetch
  positions: Record<string, { shares: number; costBasis?: number }>

  // actions
  setSelected: (tickers: string[]) => void
  addTicker: (ticker: string) => void
  removeTicker: (ticker: string) => void
  setRange: (preset: RangePreset, from?: string, to?: string) => void
  setFinnhubToken: (token: string) => void
  fetchAll: () => Promise<void>
  clear: () => void
  setPosition: (ticker: string, shares: number, costBasis?: number) => void
  clearPosition: (ticker: string) => void
}

function getRangeDates(preset: RangePreset): { from: Date; to: Date } {
  const to = new Date()
  let from: Date
  switch (preset) {
    case '1D': from = subMonths(to, 0); from.setDate(from.getDate() - 1); break
    case '5D': from = subMonths(to, 0); from.setDate(from.getDate() - 5); break
    case '1M': from = subMonths(to, 1); break
    case '3M': from = subMonths(to, 3); break
    case '6M': from = subMonths(to, 6); break
    case 'YTD': from = startOfYear(to); break
    case '1Y': from = subYears(to, 1); break
    case '2Y': from = subYears(to, 2); break
    case '5Y':
    default: from = subYears(to, 5); break
  }
  return { from, to }
}

// Debounce helper (module scope) for resilience: prevents hammering Yahoo on rapid range/selection changes from buttons, keys, etc.
let yahooFetchDebounce: ReturnType<typeof setTimeout> | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function scheduleYahooFetch(getter: () => any) {
  if (yahooFetchDebounce) clearTimeout(yahooFetchDebounce)
  yahooFetchDebounce = setTimeout(() => {
    const state = getter()
    if (state?.selected?.length > 0 && typeof state.fetchAll === 'function') {
      state.fetchAll()
    }
  }, 300)
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      selected: ['NVDA', 'AAPL', 'TSLA', 'META'],
      rangePreset: '5Y',
      customFrom: undefined,
      customTo: undefined,
      series: {},
      quotes: {},
      news: [],
      marketNews: [],
      earnings: [],
      finnhubToken: (() => {
        if (typeof window === 'undefined') return ''
        // Support Vercel environment variable (must be prefixed VITE_ for Vite client exposure)
        const envToken = (import.meta as any).env?.VITE_FINNHUB_TOKEN
        if (envToken) return envToken
        return localStorage.getItem('bs_finnhub') || ''
      })(),
      loading: false,
      lastUpdated: null,
      positions: {},

      setSelected: (tickers) => {
        set({ selected: tickers.slice(0, 10) })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        scheduleYahooFetch(get as any)
      },

      addTicker: (ticker) => {
        const t = ticker.trim().toUpperCase()
        if (!t) return
        const { selected } = get()
        if (selected.includes(t) || selected.length >= 10) return
        set({ selected: [...selected, t] })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        scheduleYahooFetch(get as any)
      },

      removeTicker: (ticker) => {
        set((s) => ({ selected: s.selected.filter((x) => x !== ticker) }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        scheduleYahooFetch(get as any)
      },

      setRange: (preset, from, to) => {
        set({
          rangePreset: preset,
          customFrom: from,
          customTo: to,
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        scheduleYahooFetch(get as any)
      },

      setFinnhubToken: (token) => {
        if (typeof window !== 'undefined') localStorage.setItem('bs_finnhub', token)
        set({ finnhubToken: token })
      },

      clear: () => set({ selected: [], series: {}, quotes: {}, news: [], marketNews: [], earnings: [], lastUpdated: null, positions: {} }),

      setPosition: (ticker, shares, costBasis) => {
        const t = ticker.toUpperCase()
        set((state) => {
          const newPositions = { ...state.positions }
          if (shares <= 0) {
            delete newPositions[t]
          } else {
            newPositions[t] = { shares, costBasis: costBasis ?? newPositions[t]?.costBasis }
          }
          return { positions: newPositions }
        })
      },

      clearPosition: (ticker) => {
        const t = ticker.toUpperCase()
        set((state) => {
          const newPositions = { ...state.positions }
          delete newPositions[t]
          return { positions: newPositions }
        })
      },

      fetchAll: async () => {
        const { selected, rangePreset, finnhubToken } = get()
        if (selected.length === 0) return

        set({ loading: true })

        const { from, to } = getRangeDates(rangePreset)
        const period1 = Math.floor(from.getTime() / 1000)
        const period2 = Math.floor(to.getTime() / 1000)

        // 1. Yahoo prices (always works, no key)
        const newSeries: Record<string, PricePoint[]> = {}
        const newQuotes: Record<string, { price: number; change: number }> = {}

        await Promise.all(
          selected.map(async (symbol) => {
            try {
              const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?period1=${period1}&period2=${period2}&interval=1d&indicators=quote&includeTimestamps=true`
              const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
              const json = await res.json()
              const result = json?.chart?.result?.[0]
              if (!result) return

              const timestamps: number[] = result.timestamp || []
              const q = result.indicators?.quote?.[0] || {}
              const closes: number[] = q.close || []
              const opens: number[] = q.open || []
              const highs: number[] = q.high || []
              const lows: number[] = q.low || []
              const volumes: number[] = q.volume || []

              const points: PricePoint[] = []
              for (let i = 0; i < timestamps.length; i++) {
                if (closes[i] != null) {
                  points.push({
                    time: timestamps[i],
                    value: closes[i],
                    close: closes[i],
                    open: opens[i],
                    high: highs[i],
                    low: lows[i],
                    volume: volumes[i],
                  })
                }
              }
              newSeries[symbol] = points

              // last price + rough change
              const last = points[points.length - 1]?.value
              const first = points[0]?.value
              const chg = first && last ? ((last - first) / first) * 100 : 0
              if (last) newQuotes[symbol] = { price: last, change: chg }
            } catch {
              // swallow per-symbol; real app would surface
              console.warn('Yahoo fetch failed for', symbol)
            }
          })
        )

        // 1b. Current live quotes from Finnhub (preferred when token present for reliable current price + daily change)
        if (finnhubToken) {
          await Promise.all(
            selected.map(async (symbol) => {
              try {
                const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubToken}`
                const res = await fetch(url)
                const q = await res.json()
                if (q && typeof q.c === 'number') {
                  newQuotes[symbol] = { price: q.c, change: q.dp || 0 }
                }
              } catch {
                console.warn('Finnhub current quote failed for', symbol)
              }
            })
          )
        }

        // 2. Finnhub (optional) for news/earnings/market news
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let fetchedNews: any[] = []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let fetchedMarketNews: any[] = []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let fetchedEarnings: any[] = []

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fetchedNewsLocal: any[] = []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fetchedEarningsLocal: any[] = []

        if (finnhubToken) {
          const today = format(new Date(), 'yyyy-MM-dd')
          const fromStr = format(from, 'yyyy-MM-dd')

          if (selected.length > 0) {
            await Promise.all(selected.map(async (symbol) => {
              try {
                // company news
                const nUrl = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromStr}&to=${today}&token=${finnhubToken}`
                const nRes = await fetch(nUrl)
                const nData = await nRes.json()
                if (Array.isArray(nData)) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  fetchedNewsLocal.push(...nData.slice(0, 4).map((n: any) => ({ ...n, ticker: symbol })))
                }

                // earnings
                const eUrl = `https://finnhub.io/api/v1/stock/earnings?symbol=${symbol}&token=${finnhubToken}`
                const eRes = await fetch(eUrl)
                const eData = await eRes.json()
                if (Array.isArray(eData)) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  fetchedEarningsLocal.push(...eData.slice(0, 2).map((e: any) => ({ ...e, ticker: symbol })))
                }
              } catch {
                console.warn('Finnhub failed', symbol)
              }
            }))
          }

          // Market news (general) — independent of selected tickers; when token present
          try {
            const mUrl = `https://finnhub.io/api/v1/news?category=general&token=${finnhubToken}`
            const mRes = await fetch(mUrl)
            const mData = await mRes.json()
            if (Array.isArray(mData)) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              fetchedMarketNews = mData.slice(0, 5).map((n: any) => ({ ...n, ticker: 'MKT' }))
            }
          } catch {
            console.warn('Finnhub market news failed')
          }

          fetchedNews = fetchedNewsLocal
          fetchedEarnings = fetchedEarningsLocal
        }

        set({
          series: newSeries,
          quotes: newQuotes,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          news: fetchedNews.slice(0, 12) as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          marketNews: fetchedMarketNews as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          earnings: fetchedEarnings as any,
          loading: false,
          lastUpdated: Date.now(),
        })
      },
    }),
    {
      name: 'brianstocks-watchlist',
      partialize: (s) => ({
        selected: s.selected,
        rangePreset: s.rangePreset,
        finnhubToken: s.finnhubToken,
        positions: s.positions,
      }),
    }
  )
)

// --- X / news helpers (exported for UI + future; pure, no side effects) ---

function getSentimentTerms(preset: RangePreset): string {
  const shortTerm: RangePreset[] = ['1D', '5D', '1M']
  if (shortTerm.includes(preset)) {
    // near-term: focus on events/earnings/sentiment catalysts
    return '(earnings OR beat OR miss OR upgrade OR "this week" OR catalyst)'
  }
  // longer term: aspirational / momentum words
  return '(moon OR tothemoon OR rocket OR bullish OR hodl OR "to the moon" OR long)'
}

export function buildXSearchQuery(tickers: string[], rangePreset: RangePreset): string {
  if (!tickers || tickers.length === 0) return ''
  // sophisticated: OR for multiple tickers + context sentiment words chosen by range
  const tickerTerms = tickers.map((t) => '$' + t.toUpperCase())
  const base = tickerTerms.length > 1 ? tickerTerms.join(' OR ') : tickerTerms[0]
  const sentiment = getSentimentTerms(rangePreset)
  return `${base} ${sentiment}`.trim()
}

export function buildXSearchUrl(tickers: string[], rangePreset: RangePreset, since: string): string {
  const q = buildXSearchQuery(tickers, rangePreset)
  if (!q) return 'https://x.com/explore'
  // encode for safe URL; keep the since: filter + live
  return `https://x.com/search?q=${encodeURIComponent(q)}%20since%3A${since}&f=live`
}

// very light simulated buzz metric (non-network, for X panel flair)
export function computeSimulatedBuzz(selectedCount: number, rangePreset: RangePreset): number {
  if (!selectedCount || selectedCount <= 0) return 0
  const baseFactor = ['1D', '5D'].includes(rangePreset) ? 21 : ['1M', '3M'].includes(rangePreset) ? 14 : 8
  const base = selectedCount * baseFactor
  const jitter = Math.floor(Math.random() * 32) + (['1D', '5D'].includes(rangePreset) ? 18 : 7)
  return Math.min(999, Math.max(7, Math.floor(base + jitter)))
}
