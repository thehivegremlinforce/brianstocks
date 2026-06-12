import type { RangePreset } from '../types/market'

export interface ChartResolution {
  finnhub: string
  yahoo: string
  label: string
}

/** Match interval to range so short presets get enough bars to render */
export function getChartResolution(preset: RangePreset): ChartResolution {
  switch (preset) {
    case '1D':
      return { finnhub: '5', yahoo: '5m', label: '5-MIN BARS' }
    case '5D':
      return { finnhub: '30', yahoo: '30m', label: '30-MIN BARS' }
    case '1M':
      return { finnhub: '60', yahoo: '60m', label: 'HOURLY BARS' }
    default:
      return { finnhub: 'D', yahoo: '1d', label: 'DAILY BARS' }
  }
}