interface ChartLegendProps {
  tickers: string[]
  colors: Record<string, string>
  primaryTicker?: string
  chartType: 'line' | 'candle'
}

export function ChartLegend({ tickers, colors, primaryTicker, chartType }: ChartLegendProps) {
  if (tickers.length === 0) return null

  const displayTickers =
    chartType === 'candle' && primaryTicker ? [primaryTicker] : tickers

  return (
    <div className="chart-legend" role="list" aria-label="Chart series legend">
      {chartType === 'candle' && primaryTicker && (
        <span className="chart-legend__primary-badge">PRIMARY: {primaryTicker}</span>
      )}
      {displayTickers.map((ticker) => {
        const color = colors[ticker] ?? '#67e8f9'
        return (
          <div key={ticker} className="chart-legend__item" role="listitem">
            <span className="chart-legend__swatch" style={{ backgroundColor: color }} aria-hidden />
            <span className="chart-legend__label">{ticker}</span>
          </div>
        )
      })}
      {chartType === 'line' && tickers.length > 1 && (
        <span className="chart-legend__hint">{tickers.length} SERIES</span>
      )}
    </div>
  )
}