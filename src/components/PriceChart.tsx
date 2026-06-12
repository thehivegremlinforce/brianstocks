import { useEffect, useRef } from 'react'
import * as LightweightCharts from 'lightweight-charts'
import type { PricePoint } from '../types/market'
import { getWatchlistColors, getWatchlistLineStyles } from '../constants/tickerColors'

interface Props {
  series: Record<string, PricePoint[]>
  normalize?: boolean
  height?: number
  chartType?: 'line' | 'candle'
  showVolume?: boolean
  indicators?: { sma20?: boolean; sma50?: boolean }
  primaryTicker?: string
  watchlistOrder?: string[]
}

export function PriceChart(props: Props) {
  const {
    series,
    normalize = false,
    height = 420,
    chartType = 'line',
    showVolume = true,
    indicators = {},
    primaryTicker: primaryTickerProp,
    watchlistOrder,
  } = props
  const containerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null)

  // Minimal SMA computation (client-side from closes) — for indicators feature
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
    const initialWidth = Math.max(container.clientWidth, container.offsetWidth, 320)
    const chart = LightweightCharts.createChart(container, {
      width: initialWidth,
      height,
      layout: {
        background: { type: LightweightCharts.ColorType.Solid, color: '#0a0a0a' },
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

    const tickers = Object.keys(series).filter((t) => (series[t]?.length ?? 0) > 0)
    const order = watchlistOrder ?? tickers
    const colorMap = getWatchlistColors(order)
    const lineStyleMap = getWatchlistLineStyles(order)
    if (tickers.length === 0) {
      chart.timeScale().fitContent()
    }

    const isCandle = chartType === 'candle'
    const primaryTicker =
      primaryTickerProp && tickers.includes(primaryTickerProp)
        ? primaryTickerProp
        : tickers[0]
    const displayTickers = isCandle && primaryTicker ? [primaryTicker] : tickers

    displayTickers.forEach((ticker) => {
      const points = series[ticker] || []
      if (points.length === 0) return

      const key = ticker.toUpperCase()
      const color = colorMap[key] ?? colorMap[ticker]
      const lineStyle = lineStyleMap[key] ?? 0

      // Raw closes for indicators (always compute on actual closes)
      const rawCloses = points.map(p => ({ time: p.time, value: p.value }))

      // Display data (apply normalize only for line mode; candles always raw absolute)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data = points.map(p => ({ time: p.time as any, value: p.value }))
      let base = 1
      const canNormalize = !isCandle && normalize && data.length > 0
      if (canNormalize) {
        base = data[0].value
        data = data.map(d => ({ ...d, value: (d.value / base) * 100 }))
      }

      if (isCandle) {
        // Use rich OHLC from store (already populated). Note: close is .value
        const candleData = points
          .filter(p => p.open != null && p.high != null && p.low != null)
          .map(p => ({
            time: p.time as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            open: p.open!,
            high: p.high!,
            low: p.low!,
            close: p.value,
          }))
        if (candleData.length > 0) {
          const candle = chart.addSeries(LightweightCharts.CandlestickSeries, {
            upColor: '#67e8f9',
            downColor: '#f472b6',
            borderUpColor: '#67e8f9',
            borderDownColor: '#f472b6',
            wickUpColor: '#67e8f9',
            wickDownColor: '#f472b6',
            priceLineVisible: false,
            lastValueVisible: true,
          })
          candle.setData(candleData)
        }
      } else {
        // LINE mode
        const line = chart.addSeries(LightweightCharts.LineSeries, {
          color,
          lineWidth: 3,
          lineStyle,
          priceLineVisible: false,
          lastValueVisible: true,
        })
        line.setData(data)
      }

      // Indicators: SMA 20 / 50 — only rendered for displayed tickers (primary when candle)
      const show20 = !!indicators.sma20
      const show50 = !!indicators.sma50
      if (show20 || show50) {
        const smaColor = color
        if (show20) {
          const sma20Raw = calculateSMA(rawCloses, 20)
          const sma20Disp = sma20Raw.map((d: { time: number; value: number }) => ({ time: d.time as any, value: canNormalize ? (d.value / base) * 100 : d.value })) // eslint-disable-line @typescript-eslint/no-explicit-any
          if (sma20Disp.length > 0) {
            const sma20 = chart.addSeries(LightweightCharts.LineSeries, {
              color: smaColor,
              lineWidth: 1,
              lineStyle: 2, // dashed
              priceLineVisible: false,
              lastValueVisible: false,
            })
            sma20.setData(sma20Disp)
          }
        }
        if (show50) {
          const sma50Raw = calculateSMA(rawCloses, 50)
          const sma50Disp = sma50Raw.map((d: { time: number; value: number }) => ({ time: d.time as any, value: canNormalize ? (d.value / base) * 100 : d.value })) // eslint-disable-line @typescript-eslint/no-explicit-any
          if (sma50Disp.length > 0) {
            const sma50 = chart.addSeries(LightweightCharts.LineSeries, {
              color: smaColor,
              lineWidth: 1,
              lineStyle: 2, // dashed
              priceLineVisible: false,
              lastValueVisible: false,
            })
            sma50.setData(sma50Disp)
          }
        }
      }
    })

    // Volume histogram (pane 1) — primary ticker only for sensible UX (even in line+multi)
    if (showVolume && primaryTicker) {
      const points = series[primaryTicker] || []
      const volData = points
        .filter(p => p.volume != null && p.volume > 0)
        .map((p, idx, arr) => {
          // Color volume bars by direction vs prev close (.value) (subtle telemetry)
          const barColor = (idx > 0 && arr[idx - 1].value != null)
            ? ((p.value >= arr[idx - 1].value) ? '#475569' : '#3f2a2a')
            : '#475569'
          return { time: p.time as any, value: p.volume!, color: barColor } // eslint-disable-line @typescript-eslint/no-explicit-any
        })
      if (volData.length > 0) {
        const volSeries = chart.addSeries(
          LightweightCharts.HistogramSeries,
          {
            color: '#555555',
            priceFormat: { type: 'volume' },
            priceLineVisible: false,
            lastValueVisible: false,
          },
          1 // paneIndex for bottom volume pane
        )
        volSeries.setData(volData)
      }
    }

    // Adjust pane heights for volume (stretch favors small bottom vol pane)
    const panes = chart.panes()
    if (showVolume && panes.length > 1) {
      panes[0]?.setStretchFactor(1.0)
      panes[1]?.setStretchFactor(0.28)
    }

    // fit content
    chart.timeScale().fitContent()

    const handleResize = () => {
      if (!containerRef.current) return
      const w = containerRef.current.clientWidth
      if (w > 0) chart.resize(w, height)
    }

    handleResize()
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)
    window.addEventListener('resize', handleResize)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [series, normalize, height, chartType, showVolume, indicators, primaryTickerProp, watchlistOrder])

  return (
    <div
      ref={containerRef}
      className="w-full"
      style={{ height, background: '#0a0a0a' }}
    />
  )
}
