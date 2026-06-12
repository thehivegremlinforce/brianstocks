export type RangePreset =
  | '1D' | '5D' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | '2Y' | '5Y'

export interface PricePoint {
  time: number // unix seconds for lightweight-charts
  value: number
  close?: number
  volume?: number
  high?: number
  low?: number
  open?: number
}

export interface Quote {
  price: number
  change: number
}

export interface NewsItem {
  id?: number
  headline?: string
  title?: string
  summary?: string
  source?: string
  url?: string
  datetime?: number
  ticker?: string
  category?: string
  image?: string
}

export interface EarningItem {
  actual?: number
  estimate?: number
  period?: string
  date?: string
  quarter?: number
  surprise?: number
  surprisePercent?: number
  symbol?: string
  year?: number
  ticker?: string
}

export interface FinnhubCandleResponse {
  c?: number[]
  h?: number[]
  l?: number[]
  o?: number[]
  s?: string
  t?: number[]
  v?: number[]
}

export interface YahooChartQuote {
  close?: (number | null)[]
  open?: (number | null)[]
  high?: (number | null)[]
  low?: (number | null)[]
  volume?: (number | null)[]
}

export interface YahooChartResult {
  timestamp?: number[]
  indicators?: {
    quote?: YahooChartQuote[]
  }
}