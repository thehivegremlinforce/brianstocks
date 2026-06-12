import { useState, useEffect, useMemo } from 'react'
import { Plus, X, Settings, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useWatchlistStore, type RangePreset } from './store/watchlistStore'
import { PriceChart } from './components/PriceChart'
import { ChartCommandBar } from './components/ChartCommandBar'
import { ChartLegend } from './components/ChartLegend'
import { QuoteStrip } from './components/QuoteStrip'
import { TelemetryBar, type MarketStatus } from './components/TelemetryBar'

import { useKeyboard } from './hooks/useKeyboard'
import { getChartResolution } from './utils/chartResolution'
import { getDateRangeStrings } from './utils/rangeDates'
import { buildXSearchUrl } from './store/watchlistStore'

const POPULAR = ['NVDA', 'AAPL', 'TSLA', 'META', 'AMZN', 'GOOGL', 'MSFT', 'AMD', 'AVGO', 'SMCI']
const RANGES: RangePreset[] = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '2Y', '5Y']

// SPACEX TELEMETRY: US Market status (NYSE hours in ET)
function getUSMarketStatus(): MarketStatus {
  try {
    const now = new Date()
    const etStr = now.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    })
    const [hStr, mStr] = etStr.split(':')
    const hour = parseInt(hStr, 10) || 0
    const minute = parseInt(mStr, 10) || 0
    const mins = hour * 60 + minute
    const day = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' })).getDay()
    if (day === 0 || day === 6) return 'CLOSED'
    if (mins >= 4 * 60 && mins < 9 * 60 + 30) return 'PRE'
    if (mins >= 9 * 60 + 30 && mins < 16 * 60) return 'OPEN'
    if (mins >= 16 * 60 && mins < 20 * 60) return 'AFTER'
    return 'CLOSED'
  } catch {
    return 'CLOSED'
  }
}

function formatLastUpdate(ts: number | null): string {
  if (!ts) return '—'
  const d = new Date(ts)
  // Show as UTC HH:MM:SS for telemetry feel
  const hh = d.getUTCHours().toString().padStart(2, '0')
  const mm = d.getUTCMinutes().toString().padStart(2, '0')
  const ss = d.getUTCSeconds().toString().padStart(2, '0')
  return `${hh}:${mm}:${ss} UTC`
}

export default function BrianStocks() {
  const {
    selected,
    rangePreset,
    series,
    quotes,
    news,
    marketNews,
    earnings,
    finnhubToken,
    loading,
    lastUpdated,
    positions,
    addTicker,
    removeTicker,
    setRange,
    setFinnhubToken,
    setSelected,
    fetchAll,
    clear,
    setPosition,
    clearPosition,
  } = useWatchlistStore()

  const [tickerInput, setTickerInput] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [localToken, setLocalToken] = useState(finnhubToken)
  const [normalize, setNormalize] = useState(false)

  // Chart mode controls (isolated addition — no impact on portfolio/news)
  const [chartType, setChartType] = useState<'line' | 'candle'>('line')
  const [showVolume, setShowVolume] = useState(true)
  const [showSma20, setShowSma20] = useState(false)
  const [showSma50, setShowSma50] = useState(false)

  // Live UTC clock for telemetry
  const [currentTime, setCurrentTime] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Format live UTC time like SPACEX telemetry
  const utcTime = currentTime.toISOString().slice(11, 19) + ' UTC'

  const canAdd = selected.length < 10
  const { since, until } = getDateRangeStrings(rangePreset)
  const marketStatus = getUSMarketStatus()
  const lastUpdateStr = formatLastUpdate(lastUpdated)
  const primaryTicker = selected[0]
  const chartResolution = getChartResolution(rangePreset)

  // === PORTFOLIO SIM (SPACEX readout) ===
  const positionRows = selected.map((ticker) => {
    const pos = positions[ticker] || { shares: 0 }
    const q = quotes[ticker]
    const price = q?.price ?? 0
    const marketValue = pos.shares * price
    const basis = pos.costBasis ?? price
    const costValue = pos.shares * basis
    const pnl = marketValue - costValue
    const pnlPct = costValue !== 0 ? (pnl / costValue) * 100 : 0
    return {
      ticker,
      shares: pos.shares,
      costBasis: pos.costBasis,
      price,
      marketValue,
      pnl,
      pnlPct,
    }
  })
  const activePositions = positionRows.filter((r) => r.shares > 0)
  const totalMarketValue = activePositions.reduce((sum, r) => sum + r.marketValue, 0)
  const totalBasisValue = activePositions.reduce((sum, r) => sum + (r.shares * (r.costBasis ?? r.price)), 0)
  const totalPnl = totalMarketValue - totalBasisValue
  const totalPnlPct = totalBasisValue !== 0 ? (totalPnl / totalBasisValue) * 100 : 0

  useKeyboard(
    () => setShowSettings(true),
    () => setShowHelp(true),
    () => {
      setShowSettings(false)
      setShowHelp(false)
    },
  )

  // Auto-fetch on mount ONLY. Resilience debounce for rapid range/selected/add/remove now lives inside
  // store (setRange, addTicker, removeTicker, setSelected) via 300ms scheduleYahooFetch — protects Yahoo.
  useEffect(() => {
    fetchAll()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- initial mount only; store handles debounced refetch on changes

  function handleAdd() {
    const t = tickerInput.trim().toUpperCase()
    if (!t) return
    if (selected.includes(t)) {
      toast.error(`${t} is already on the watchlist`)
      return
    }
    if (!canAdd) {
      toast.error('Watchlist is full (10 tickers max)')
      return
    }
    addTicker(t)
    setTickerInput('')
    toast.success(`Added ${t}`)
  }

  function handleQuick(t: string) {
    if (canAdd && !selected.includes(t)) {
      addTicker(t)
      toast.success(`Added ${t}`)
    }
  }

  function handleRemove(t: string) {
    removeTicker(t)
  }

  function handleRange(p: RangePreset) {
    setRange(p)
  }

  function handleSaveToken() {
    setFinnhubToken(localToken.trim())
    setShowSettings(false)
    toast.success(localToken ? 'Finnhub token saved' : 'Token cleared')
    // trigger refresh
    setTimeout(() => fetchAll(), 80)
  }

  function handleClearToken() {
    setLocalToken('')
    setFinnhubToken('')
    setShowSettings(false)
    toast('Token cleared')
  }

  function loadPreset(name: string) {
    const presets: Record<string, string[]> = {
      mag7: ['AAPL', 'AMZN', 'GOOGL', 'META', 'MSFT', 'NVDA', 'TSLA'],
      aiSemis: ['NVDA', 'AMD', 'AVGO', 'SMCI', 'INTC'],
    }
    const list = presets[name] || []
    if (list.length) {
      setSelected(list)
      toast.success(`Preset loaded: ${name === 'mag7' ? 'MAGNIFICENT 7' : 'AI SEMIS'}`)
    }
  }

  const chartSeries = useMemo(() => {
    const out: Record<string, typeof series[string]> = {}
    for (const t of selected) {
      if (series[t]?.length) out[t] = series[t]
    }
    return out
  }, [selected, series])

  const hasData = selected.some((t) => (series[t]?.length ?? 0) > 0)

  return (
    <div className="min-h-screen bg-[#000000] text-white flex flex-col">
      {/* SPACEX HEADER — with integrated persistent telemetry bar */}
      <header className="sticky top-0 z-50 border-b border-[#222] bg-[#000000]/95 backdrop-blur">
        {/* Title / controls row */}
        <div className="max-w-[1280px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-[#67e8f9]" />
              <span className="font-bold tracking-[3.5px] text-[21px]">BRIANSTOCKS</span>
            </div>
            <span className="text-[10px] tracking-[2.5px] text-[#888] border-l border-[#222] pl-3">PERSONAL MISSION CONTROL</span>
          </div>

          <div className="flex items-center gap-2 text-xs uppercase tracking-widest">
            <div className="px-3 py-1 border border-[#222] rounded text-[#888] font-mono tracking-[1.5px]">
              {selected.length}/10
            </div>
            <button onClick={() => setShowSettings(true)} className="btn flex items-center gap-1.5">
              <Settings size={14} /> SETTINGS
            </button>
            <button onClick={() => fetchAll()} className="btn flex items-center gap-1.5" disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> REFRESH
            </button>
          </div>
        </div>

        <TelemetryBar
          utcTime={utcTime}
          marketStatus={marketStatus}
          lastUpdateStr={lastUpdateStr}
          loading={loading}
        />
      </header>

      <div className="max-w-[1280px] mx-auto px-6 pt-6 pb-12 flex-1 flex flex-col gap-6">
        <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6">
          {/* WATCHLIST SIDEBAR */}
          <div className="panel p-4 flex flex-col">
            <div className="section-title">WATCHLIST</div>

            <div className="flex gap-2 mb-3">
              <input
                id="ticker-input"
                value={tickerInput}
                onChange={e => setTickerInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                placeholder="ADD TICKER"
                className="input flex-1 font-mono tracking-[2px]"
                maxLength={6}
                disabled={!canAdd}
                list="ticker-suggestions"
              />
              <datalist id="ticker-suggestions">
                {POPULAR.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <button
                onClick={handleAdd}
                disabled={!canAdd || !tickerInput}
                className="btn btn-accent flex items-center gap-1 disabled:opacity-40"
              >
                <Plus size={15} /> ADD
              </button>
            </div>

            <div className="mb-2">
              <div className="label mb-1">POPULAR</div>
              <div className="flex flex-wrap gap-1">
                {POPULAR.map(t => (
                  <button
                    key={t}
                    onClick={() => handleQuick(t)}
                    disabled={selected.includes(t) || !canAdd}
                    className="text-[10px] px-2 py-px border border-[#222] hover:border-[#67e8f9] active:bg-[#67e8f9] active:text-black disabled:opacity-30"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* BONUS: PRESET WATCHLISTS for quick mission load */}
            <div className="mb-3">
              <div className="label mb-1">PRESETS</div>
              <div className="flex flex-wrap gap-1">
                <button
                  onClick={() => loadPreset('mag7')}
                  className="text-[10px] px-2 py-px border border-[#222] hover:border-[#67e8f9] active:bg-[#67e8f9] active:text-black"
                >
                  MAGNIFICENT 7
                </button>
                <button
                  onClick={() => loadPreset('aiSemis')}
                  className="text-[10px] px-2 py-px border border-[#222] hover:border-[#67e8f9] active:bg-[#67e8f9] active:text-black"
                >
                  AI SEMIS
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto space-y-px pr-1 text-sm">
              {selected.length === 0 && (
                <div className="text-[#555] text-xs py-10 text-center border border-dashed border-[#222]">
                  SELECT UP TO 10 TICKERS
                </div>
              )}
              {selected.map((ticker) => (
                <div key={ticker} className="flex items-center justify-between bg-[#111] border border-[#222] px-3 py-2 group">
                  <div className="font-mono font-bold tracking-[2.5px]">{ticker}</div>
                  <button
                    onClick={() => handleRemove(ticker)}
                    className="text-[#555] hover:text-[#ef4444]"
                    aria-label={`Remove ${ticker}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-3 mt-auto text-[10px] text-[#555] border-t border-[#222]">
              {selected.length} / 10 • YAHOO + FINNHUB
            </div>
          </div>

          {/* CHART + QUOTES */}
          <div className="flex flex-col gap-3 min-w-0">
            <div>
              <div className="mb-2">
                <div className="label">COMPARATIVE PRICE HISTORY • {rangePreset}</div>
                <div className="text-xl font-semibold tracking-[-0.5px]">BRIANSTOCKS WATCHLIST</div>
                <ChartLegend
                  tickers={selected}
                  primaryTicker={primaryTicker}
                  chartType={chartType}
                />
              </div>

              <ChartCommandBar
                rangePreset={rangePreset}
                ranges={RANGES}
                onRangeChange={handleRange}
                chartType={chartType}
                onChartTypeChange={setChartType}
                showVolume={showVolume}
                onVolumeToggle={() => setShowVolume(!showVolume)}
                showSma20={showSma20}
                showSma50={showSma50}
                onSmaToggle={(which, value) => {
                  if (which === 'sma20') setShowSma20(value)
                  else setShowSma50(value)
                }}
                normalize={normalize}
                onNormalizeToggle={() => setNormalize(!normalize)}
                selectedCount={selected.length}
                onClear={() => {
                  clear()
                  toast.info('Watchlist cleared')
                }}
                dateRangeLabel={`${since} → ${until}`}
              />

              <div className="chart-container p-2 mt-2">
                {hasData ? (
                  <PriceChart
                    series={chartSeries}
                    watchlistOrder={selected}
                    normalize={normalize}
                    height={420}
                    chartType={chartType}
                    showVolume={showVolume}
                    indicators={{ sma20: showSma20, sma50: showSma50 }}
                    primaryTicker={primaryTicker}
                  />
                ) : (
                  <div className="h-[420px] flex items-center justify-center text-[#555] text-sm font-mono tracking-widest">
                    {loading
                      ? 'FETCHING DATA FROM YAHOO…'
                      : selected.length > 0
                        ? 'NO PRICE DATA — PRESS REFRESH (R)'
                        : 'ADD TICKERS TO LOAD CHART'}
                  </div>
                )}
              </div>
              <div className="text-[10px] text-[#555] mt-1.5 tracking-[1px]">
                SOURCE: {finnhubToken ? 'FINNHUB' : 'YAHOO'} • {chartResolution.label} • UP TO 5 YEARS
              </div>
            </div>

            <QuoteStrip
              tickers={selected}
              quotes={quotes}
              loading={loading}
              deltaLabel={finnhubToken ? 'DAY Δ%' : 'RANGE Δ%'}
            />
          </div>
        </div>

        {/* MY POSITIONS — SPACEX PORTFOLIO READOUT (new from fan-out) */}
        <div className="panel p-4">
          <div className="section-title flex items-center justify-between">
            <span>MY POSITIONS</span>
            <span className="text-[10px] text-[#67e8f9] font-mono tracking-widest">
              {activePositions.length} ACTIVE • TOTAL VALUE {totalMarketValue.toFixed(0)}
            </span>
          </div>

          {activePositions.length > 0 ? (
            <>
              {/* Summary bar */}
              <div className="grid grid-cols-3 gap-3 mb-3 text-center">
                <div>
                  <div className="label">MARKET VALUE</div>
                  <div className="metric-lg font-mono tabular-nums">${totalMarketValue.toLocaleString()}</div>
                </div>
                <div>
                  <div className="label">UNREALIZED P&amp;L</div>
                  <div className={`metric-lg font-mono tabular-nums ${totalPnl >= 0 ? 'delta-pos' : 'delta-neg'}`}>
                    {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(0)}
                  </div>
                </div>
                <div>
                  <div className="label">P&amp;L %</div>
                  <div className={`metric-lg font-mono tabular-nums ${totalPnlPct >= 0 ? 'delta-pos' : 'delta-neg'}`}>
                    {totalPnlPct >= 0 ? '+' : ''}{totalPnlPct.toFixed(1)}%
                  </div>
                </div>
              </div>

              {/* Positions table with editable inputs (all selected tickers) */}
              <table className="data text-xs">
                <thead>
                  <tr>
                    <th>TICKER</th>
                    <th>SHARES</th>
                    <th>ENTRY</th>
                    <th>CURRENT</th>
                    <th>MKT VALUE</th>
                    <th>P&amp;L</th>
                    <th>P&amp;L %</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {positionRows.map((row) => (
                    <tr key={row.ticker}>
                      <td className="font-bold font-mono tracking-widest">{row.ticker}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.shares}
                          onChange={(e) => setPosition(row.ticker, parseFloat(e.target.value) || 0, row.costBasis)}
                          className="input w-16 py-0.5 text-xs tabular-nums"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.costBasis ?? row.price}
                          onChange={(e) => setPosition(row.ticker, row.shares, parseFloat(e.target.value) || undefined)}
                          className="input w-16 py-0.5 text-xs tabular-nums"
                          placeholder={row.price.toFixed(2)}
                        />
                      </td>
                      <td className="font-mono tabular-nums">{row.price.toFixed(2)}</td>
                      <td className="font-mono tabular-nums">${row.marketValue.toFixed(0)}</td>
                      <td className={`font-mono tabular-nums ${row.pnl >= 0 ? 'delta-pos' : 'delta-neg'}`}>
                        {row.pnl >= 0 ? '+' : ''}${row.pnl.toFixed(0)}
                      </td>
                      <td className={`font-mono tabular-nums ${row.pnlPct >= 0 ? 'delta-pos' : 'delta-neg'}`}>
                        {row.pnlPct >= 0 ? '+' : ''}{row.pnlPct.toFixed(1)}%
                      </td>
                      <td>
                        <button onClick={() => clearPosition(row.ticker)} className="text-[#555] hover:text-[#ef4444] text-[10px]">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <div className="text-[#555] text-xs py-2">
              Enter shares + optional entry price above or in the inputs to simulate P&amp;L. Positions persist locally.
            </div>
          )}

          <div className="mt-2 text-[9px] text-[#555] tracking-widest">
            EDIT SHARES / ENTRY → LIVE VALUE + P&amp;L USING CURRENT QUOTES
          </div>
        </div>

        {/* DENSE BOTTOM PANELS — SPACEX MISSION CONTROL */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* NEWS */}
          <div className="panel p-4">
            <div className="section-title">NEWS {finnhubToken ? '• MARKET PULSE' : '(ADD TOKEN)'}</div>
            <div className="max-h-[218px] overflow-auto text-xs pr-1 space-y-3">
              {news.length > 0 || (marketNews && marketNews.length > 0) ? [...news, ...(marketNews || [])].slice(0, 4).map((n, i) => (
                <div key={i} className="news-item">
                  <div className="news-headline leading-tight">{n.headline || n.title}</div>
                  <div className="news-meta">
                    {n.source} • {n.ticker} • {n.datetime ? new Date(n.datetime * 1000).toLocaleDateString() : ''}
                    {n.url && (
                      <a href={n.url} target="_blank" rel="noreferrer" className="ml-2 text-[#67e8f9]">
                        OPEN
                      </a>
                    )}
                  </div>
                </div>
              )) : (
                <div className="text-[#555] text-xs py-4">
                  {finnhubToken ? 'No recent news for current range. (Finnhub rate limits — cached data retained)' : 'Enter Finnhub token in Settings for live company news.'}
                </div>
              )}
            </div>
          </div>

          {/* EARNINGS */}
          <div className="panel p-4">
            <div className="section-title">EARNINGS {finnhubToken ? '' : '(ADD TOKEN)'}</div>
            <div className="max-h-[218px] overflow-auto text-xs font-mono space-y-1.5 pr-1">
              {earnings.length > 0 ? earnings.map((e, i) => (
                <div key={i} className="flex justify-between py-0.5 border-b border-[#1f1f1f] last:border-0">
                  <span>{e.ticker}</span>
                  <span className="text-[#888]">{e.period || e.date}</span>
                  <span className={e.surprise ? (e.surprise > 0 ? 'delta-pos' : 'delta-neg') : ''}>
                    {e.surprise ? `${e.surprise > 0 ? '+' : ''}${(e.surprise * 100).toFixed(0)}%` : '—'}
                  </span>
                </div>
              )) : (
                <div className="text-[#555] py-4 text-xs">
                  {finnhubToken ? 'No earnings data returned. (Rate limited or cached empty — try REFRESH)' : 'Free Finnhub token unlocks earnings history & surprises.'}
                </div>
              )}
            </div>
          </div>

          {/* X SEARCH — honest links only, no fabricated scores */}
          <div className="panel p-4">
            <div className="section-title">TRENDING ON X</div>
            {selected.length > 0 && (
              <div className="text-[9px] text-[#888] font-mono tracking-widest mb-1">
                X SEARCH • SINCE {since}
              </div>
            )}
            <div className="space-y-2 text-sm">
              {selected.length > 0 ? (
                <>
                  {selected.slice(0, 4).map((t) => {
                    const perUrl = buildXSearchUrl([t], rangePreset, since)
                    return (
                      <a
                        key={t}
                        href={perUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="x-link flex justify-between items-baseline"
                      >
                        <span>${t} SINCE {since.slice(5)} →</span>
                        <span className="text-[9px] text-[#67e8f9] font-mono tracking-widest ml-2">X SEARCH</span>
                      </a>
                    )
                  })}
                  {(() => {
                    const allUrl = buildXSearchUrl(selected, rangePreset, since)
                    return (
                      <div className="flex items-center gap-2 pt-1">
                        <a
                          href={allUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#67e8f9] text-xs tracking-widest"
                        >
                          ALL WATCHLIST ON X (LIVE) →
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(allUrl).then(() => toast.success('X search URL copied'))
                          }}
                          className="text-[9px] px-1 py-px border border-[#333] hover:border-[#67e8f9] text-[#888] flex items-center gap-0.5"
                          title="Copy X search"
                        >
                          COPY X SEARCH
                        </button>
                      </div>
                    )
                  })()}
                </>
              ) : (
                <div className="text-[#555] text-xs">X search links will be scoped to your tickers + current date range.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-[#222] py-2.5 text-[10px] text-[#555] font-mono tracking-widest">
        <div className="max-w-[1280px] mx-auto px-6 flex justify-between items-center">
          <div>BRIANSTOCKS — SPACEX TELEMETRY STYLE — LOCAL BROWSER ONLY</div>
          <div>YAHOO PUBLIC • FINNHUB OPTIONAL • 5Y MAX • ≤10 TICKERS</div>
        </div>
      </footer>

      {/* SETTINGS MODAL — SPACEX */}
      {showSettings && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4" onClick={() => setShowSettings(false)}>
          <div
            className="panel w-full max-w-[420px] p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-dialog-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div id="settings-dialog-title" className="section-title mb-0 tracking-[3px]">SETTINGS</div>
              <button onClick={() => setShowSettings(false)} aria-label="Close settings"><X size={18} /></button>
            </div>

            <div className="space-y-5 text-sm">
              <div>
                <div className="label mb-1 tracking-[2px]">FINNHUB TOKEN (FREE — 60 CALLS/MIN)</div>
                {import.meta.env.VITE_FINNHUB_TOKEN && (
                  <div className="inline-flex items-center gap-1 text-[10px] text-[#22c55e] mb-1 px-1.5 py-0.5 bg-[#052e16] border border-[#166534] rounded">
                    ✓ Using key from Vercel environment (VITE_FINNHUB_TOKEN)
                  </div>
                )}
                <input
                  value={localToken}
                  onChange={e => setLocalToken(e.target.value)}
                  placeholder="paste your finnhub token here (or set VITE_FINNHUB_TOKEN in Vercel)"
                  className="input w-full font-mono"
                />
                <div className="mt-1 text-[#67e8f9] text-xs">
                  Sign up free → <a href="https://finnhub.io/register" target="_blank" rel="noreferrer" className="underline">finnhub.io/register</a><br />
                  <strong>For Vercel:</strong> Set <code>VITE_FINNHUB_TOKEN</code> in your Vercel project Environment Variables (Production + Preview). It will be baked in at build time.<br />
                  The Settings input can still override it for this browser/session.
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={handleSaveToken} className="btn btn-accent flex-1">SAVE + REFRESH DATA</button>
                <button onClick={handleClearToken} className="btn flex-1">CLEAR TOKEN</button>
              </div>

              <div className="text-[11px] text-[#666] border-t border-[#222] pt-3">
                Price history and basic quotes always work via Yahoo (no key required).<br />
                With a token you get live prices (via Finnhub), news, and earnings.<br />
                When <code>VITE_FINNHUB_TOKEN</code> is set in Vercel, you'll see a green indicator above. You can still paste here to override for this browser.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HELP OVERLAY — triggered by ? key */}
      {showHelp && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
          <div
            className="panel w-full max-w-[480px] p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-dialog-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div id="help-dialog-title" className="section-title mb-0 tracking-[3px]">KEYBOARD MISSION CONTROLS</div>
              <button onClick={() => setShowHelp(false)} aria-label="Close help"><X size={18} /></button>
            </div>
            <div className="space-y-3 text-sm font-mono">
              <div className="grid grid-cols-[auto,1fr] gap-x-6 gap-y-1.5 text-xs">
                <div className="text-[#67e8f9] tabular-nums">/ or P</div><div>Focus ticker input (add to portfolio)</div>
                <div className="text-[#67e8f9]">1–9</div><div>Jump to range presets (1D–5Y)</div>
                <div className="text-[#67e8f9]">R</div><div>Force refresh all data</div>
                <div className="text-[#67e8f9]">S</div><div>Open Settings (Finnhub token)</div>
                <div className="text-[#67e8f9]">?</div><div>This help overlay</div>
                <div className="text-[#67e8f9]">Cmd/Ctrl + C</div><div>Clear watchlist</div>
                <div className="text-[#67e8f9]">ESC</div><div>Close modals</div>
              </div>
              <div className="pt-2 border-t border-[#222] text-[11px] text-[#666]">
                Shortcuts disabled while focused in input fields. Pure SPACEX-style keyboard-first UX.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
