interface Quote {
  price: number
  change: number
}

interface QuoteStripProps {
  tickers: string[]
  quotes: Record<string, Quote | undefined>
  colors?: Record<string, string>
  loading?: boolean
  deltaLabel?: string
}

export function QuoteStrip({ tickers, quotes, colors = {}, loading, deltaLabel = 'Δ%' }: QuoteStripProps) {
  if (tickers.length === 0) {
    return (
      <div className="quote-strip quote-strip--empty">
        <span className="quote-strip__empty">NO TICKERS — ADD TO WATCHLIST</span>
      </div>
    )
  }

  const hasQuotes = tickers.some((t) => quotes[t])

  return (
    <div className="quote-strip" role="region" aria-label="Live quotes">
      <div className="quote-strip__header">
        <span className="quote-strip__label">QUOTES</span>
        <span className="quote-strip__delta-label">{deltaLabel}</span>
      </div>
      <div className="quote-strip__scroll">
        {tickers.map((ticker) => {
          const q = quotes[ticker]
          const color = colors[ticker]
          const deltaClass = q ? (q.change >= 0 ? 'delta-pos' : 'delta-neg') : 'delta-flat'

          return (
            <div key={ticker} className="quote-strip__cell">
              <div className="quote-strip__ticker-row">
                {color && (
                  <span
                    className="quote-strip__swatch"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                )}
                <span className="quote-strip__ticker">{ticker}</span>
              </div>
              <div className="quote-strip__price">{q ? q.price.toFixed(2) : '—'}</div>
              <div className={`quote-strip__delta ${deltaClass}`}>
                {q ? `${q.change >= 0 ? '+' : ''}${q.change.toFixed(2)}%` : '—'}
              </div>
            </div>
          )
        })}
      </div>
      {!hasQuotes && !loading && tickers.length > 0 && (
        <div className="quote-strip__warn">YAHOO RATE LIMITED — CACHED / STALE DATA</div>
      )}
    </div>
  )
}