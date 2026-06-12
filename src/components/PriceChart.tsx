import { useEffect, useRef } from 'react'
import { createChart, ColorType, LineSeries } from 'lightweight-charts'
import type { PricePoint } from '../store/watchlistStore'

interface Props {
  series: Record<string, PricePoint[]>
  normalize?: boolean
  height?: number
  // Optional advanced props (may be wired by other agents / future; declared for TS/build compat even if body simplified)
  chartType?: 'line' | 'candle'
  showVolume?: boolean
  indicators?: { sma20?: boolean; sma50?: boolean }
}

const TICKER_COLORS: Record<string, string> = {
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

export function PriceChart({
  series,
  normalize = false,
  height = 420,
  chartType: _chartType = 'line',
  showVolume: _showVolume = true,
  indicators: _indicators = {},
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null)

  // Minimal SMA computation (client-side from closes)
  function calculateSMA(points: { time: number; value: number }[], period: number): { time: number; value: number }[] {
    const result: { time: number; value: number }[] = []
    for (let i = 0; i < points.length; i++) {
      if (i < period - 1) continue
      let sum = 0
      for (let j = 0; j < period; j++) {
        sum += points[i - j].value
      }
      result.push({ time: points[i].time, value: sum / period })
    }
    return result
  }

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a0a' },
        textColor: '#888888',
      },
      grid: {
        vertLines: { color: '#222222' },
        horzLines: { color: '#222222' },
      },
      timeScale: {
        borderColor: '#222222',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#222222',
      },
      crosshair: {
        vertLine: { color: '#444444' },
        horzLine: { color: '#444444' },
      },
    })

    chartRef.current = chart

    const tickers = Object.keys(series)

    tickers.forEach((ticker) => {
      const points = series[ticker] || []
      if (points.length === 0) return

      let data = points.map(p => ({ time: p.time as any, value: p.value })) // eslint-disable-line @typescript-eslint/no-explicit-any

      if (normalize && data.length > 0) {
        const base = data[0].value
        data = data.map(d => ({ ...d, value: (d.value / base) * 100 }))
      }

      const color = TICKER_COLORS[ticker] || '#67e8f9'

      const line = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      })
      line.setData(data)
    })

    chart.timeScale().fitContent()

    const handleResize = () => {
      if (containerRef.current) {
        chart.resize(containerRef.current.clientWidth, height)
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [series, normalize, height])

  return (
    <div
      ref={containerRef}
      className="w-full"
      style={{ height, background: '#0a0a0a' }}
    />
  )
}
