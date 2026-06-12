import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { format } from 'date-fns'
import {
  batchFetch,
  fetchCandle,
  fetchCompanyNews,
  fetchEarnings,
  fetchMarketNews,
  fetchQuote,
} from '../api/finnhub'
import { fetchYahooChart } from '../api/yahoo'
import type {
  EarningItem,
  NewsItem,
  PricePoint,
  Quote,
  RangePreset,
} from '../types/market'
import { getRangeDates } from '../utils/rangeDates'

export type { PricePoint, RangePreset } from '../types/market'

interface WatchlistState {
  selected: string[]
  rangePreset: RangePreset
  customFrom?: string
  customTo?: string
  series: Record<string, PricePoint[]>
  quotes: Record<string, Quote>
  news: NewsItem[]
  marketNews: NewsItem[]
  earnings: EarningItem[]
  finnhubToken: string
  loading: boolean
  lastUpdated: number | null
  positions: Record<string, { shares: number; costBasis?: number }>
  fetchGeneration: number

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

let yahooFetchDebounce: ReturnType<typeof setTimeout> | null = null
let activeFetchId = 0

function scheduleYahooFetch(getter: () => WatchlistState) {
  if (yahooFetchDebounce) clearTimeout(yahooFetchDebounce)
  yahooFetchDebounce = setTimeout(() => {
    const state = getter()
    if (state.selected.length > 0) {
      state.fetchAll()
    }
  }, 300)
}

async function fetchSeriesForSymbol(
  symbol: string,
  period1: number,
  period2: number,
  finnhubToken: string
): Promise<{ points: PricePoint[]; quote: Quote | null; ok: boolean }> {
  if (finnhubToken) {
    try {
      const points = await fetchCandle(symbol, period1, period2, finnhubToken)
      if (points.length > 0) {
        const last = points[points.length - 1]?.value
        return {
          points,
          quote: last ? { price: last, change: 0 } : null,
          ok: true,
        }
      }
    } catch {
      console.warn('Finnhub candle failed for', symbol, '— falling back to Yahoo')
    }
  }

  try {
    const { points, quote } = await fetchYahooChart(symbol, period1, period2)
    return { points, quote, ok: points.length > 0 }
  } catch {
    console.warn('Yahoo fetch failed for', symbol)
    return { points: [], quote: null, ok: false }
  }
}

function getInitialFinnhubToken(): string {
  if (typeof window === 'undefined') return ''
  const envToken = import.meta.env.VITE_FINNHUB_TOKEN
  return envToken || ''
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
      finnhubToken: getInitialFinnhubToken(),
      loading: false,
      lastUpdated: null,
      positions: {},
      fetchGeneration: 0,

      setSelected: (tickers) => {
        set({ selected: tickers.slice(0, 10) })
        scheduleYahooFetch(get)
      },

      addTicker: (ticker) => {
        const t = ticker.trim().toUpperCase()
        if (!t) return
        const { selected } = get()
        if (selected.includes(t) || selected.length >= 10) return
        set({ selected: [...selected, t] })
        // Fetch immediately for new tickers so chart updates without waiting on debounce
        const needsData = !get().series[t]?.length
        if (needsData) {
          get().fetchAll()
        } else {
          scheduleYahooFetch(get)
        }
      },

      removeTicker: (ticker) => {
        const t = ticker.toUpperCase()
        set((s) => {
          const newPositions = { ...s.positions }
          delete newPositions[t]
          return {
            selected: s.selected.filter((x) => x !== t),
            positions: newPositions,
          }
        })
        scheduleYahooFetch(get)
      },

      setRange: (preset, from, to) => {
        set({
          rangePreset: preset,
          customFrom: from,
          customTo: to,
        })
        scheduleYahooFetch(get)
      },

      setFinnhubToken: (token) => {
        set({ finnhubToken: token })
      },

      clear: () =>
        set((s) => ({
          selected: [],
          series: {},
          quotes: {},
          news: [],
          marketNews: [],
          earnings: [],
          lastUpdated: null,
          positions: {},
          fetchGeneration: s.fetchGeneration + 1,
        })),

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

        const fetchId = ++activeFetchId
        const generation = get().fetchGeneration
        set({ loading: true })

        const { from, to } = getRangeDates(rangePreset)
        const period1 = Math.floor(from.getTime() / 1000)
        const period2 = Math.floor(to.getTime() / 1000)

        const existingSeries = get().series
        const existingQuotes = get().quotes
        const existingNews = get().news
        const existingMarketNews = get().marketNews
        const existingEarnings = get().earnings

        const mergedSeries: Record<string, PricePoint[]> = { ...existingSeries }
        const mergedQuotes: Record<string, Quote> = { ...existingQuotes }
        let fetchedNews: NewsItem[] = existingNews
        let fetchedMarketNews: NewsItem[] = existingMarketNews
        let fetchedEarnings: EarningItem[] = existingEarnings
        let anySuccess = false

        try {
          const seriesResults = await batchFetch(
            selected,
            async (symbol) => {
              const result = await fetchSeriesForSymbol(symbol, period1, period2, finnhubToken)
              return { symbol, ...result }
            },
            5
          )

          for (const { symbol, points, quote, ok } of seriesResults) {
            if (ok) {
              mergedSeries[symbol] = points
              anySuccess = true
              if (quote) mergedQuotes[symbol] = quote
            }
          }

          if (finnhubToken) {
            const quoteResults = await batchFetch(
              selected,
              async (symbol) => {
                try {
                  const quote = await fetchQuote(symbol, finnhubToken)
                  return { symbol, quote, ok: quote != null }
                } catch {
                  console.warn('Finnhub current quote failed for', symbol)
                  return { symbol, quote: null, ok: false }
                }
              },
              5
            )

            for (const { symbol, quote, ok } of quoteResults) {
              if (ok && quote) {
                mergedQuotes[symbol] = quote
                anySuccess = true
              }
            }
          }

          if (finnhubToken) {
            const today = format(new Date(), 'yyyy-MM-dd')
            const fromStr = format(from, 'yyyy-MM-dd')

            const newsResults = await batchFetch(
              selected,
              async (symbol) => {
                try {
                  const [news, earnings] = await Promise.all([
                    fetchCompanyNews(symbol, fromStr, today, finnhubToken),
                    fetchEarnings(symbol, finnhubToken),
                  ])
                  return { news, earnings, ok: true }
                } catch {
                  console.warn('Finnhub failed', symbol)
                  return { news: [] as NewsItem[], earnings: [] as EarningItem[], ok: false }
                }
              },
              5
            )

            const newsLocal: NewsItem[] = []
            const earningsLocal: EarningItem[] = []
            let newsSuccess = false

            for (const { news, earnings, ok } of newsResults) {
              if (ok) {
                newsLocal.push(...news)
                earningsLocal.push(...earnings)
                newsSuccess = true
              }
            }

            try {
              const marketNews = await fetchMarketNews(finnhubToken)
              if (marketNews.length > 0) {
                fetchedMarketNews = marketNews
                newsSuccess = true
              }
            } catch {
              console.warn('Finnhub market news failed')
            }

            if (newsSuccess) {
              fetchedNews = newsLocal.slice(0, 12)
              fetchedEarnings = earningsLocal
              anySuccess = true
            }
          }

          if (get().fetchGeneration !== generation || fetchId !== activeFetchId) return

          const selectedSet = new Set(selected)
          for (const key of Object.keys(mergedSeries)) {
            if (!selectedSet.has(key)) delete mergedSeries[key]
          }
          for (const key of Object.keys(mergedQuotes)) {
            if (!selectedSet.has(key)) delete mergedQuotes[key]
          }

          set({
            series: mergedSeries,
            quotes: mergedQuotes,
            news: fetchedNews,
            marketNews: fetchedMarketNews,
            earnings: fetchedEarnings,
            ...(anySuccess ? { lastUpdated: Date.now() } : {}),
          })
        } finally {
          if (fetchId === activeFetchId) {
            set({ loading: false })
          }
        }
      },
    }),
    {
      name: 'brianstocks-watchlist',
      partialize: (s) => ({
        selected: s.selected,
        rangePreset: s.rangePreset,
        finnhubToken: s.finnhubToken,
        positions: s.positions,
        series: s.series,
        quotes: s.quotes,
        lastUpdated: s.lastUpdated,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state?.selected?.length) return
        const needsFetch = state.selected.some((t) => !(state.series?.[t]?.length))
        if (needsFetch) {
          queueMicrotask(() => useWatchlistStore.getState().fetchAll())
        }
      },
    }
  )
)

function getSentimentTerms(preset: RangePreset): string {
  const shortTerm: RangePreset[] = ['1D', '5D', '1M']
  if (shortTerm.includes(preset)) {
    return '(earnings OR beat OR miss OR upgrade OR "this week" OR catalyst)'
  }
  return '(moon OR tothemoon OR rocket OR bullish OR hodl OR "to the moon" OR long)'
}

export function buildXSearchQuery(tickers: string[], rangePreset: RangePreset): string {
  if (!tickers || tickers.length === 0) return ''
  const tickerTerms = tickers.map((t) => '$' + t.toUpperCase())
  const base = tickerTerms.length > 1 ? tickerTerms.join(' OR ') : tickerTerms[0]
  const sentiment = getSentimentTerms(rangePreset)
  return `${base} ${sentiment}`.trim()
}

export function buildXSearchUrl(tickers: string[], rangePreset: RangePreset, since: string): string {
  const q = buildXSearchQuery(tickers, rangePreset)
  if (!q) return 'https://x.com/explore'
  return `https://x.com/search?q=${encodeURIComponent(q)}%20since%3A${since}&f=live`
}

export function computeSimulatedBuzz(selectedCount: number, rangePreset: RangePreset): number {
  if (!selectedCount || selectedCount <= 0) return 0
  const baseFactor = ['1D', '5D'].includes(rangePreset) ? 21 : ['1M', '3M'].includes(rangePreset) ? 14 : 8
  const base = selectedCount * baseFactor
  const jitter = Math.floor(Math.random() * 32) + (['1D', '5D'].includes(rangePreset) ? 18 : 7)
  return Math.min(999, Math.max(7, Math.floor(base + jitter)))
}