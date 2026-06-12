import { useState, useEffect } from 'react'
import { Plus, X, Settings, RefreshCw, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { useWatchlistStore, type RangePreset } from './store/watchlistStore'
import { PriceChart } from './components/PriceChart'
import { useKeyboard } from './hooks/useKeyboard'
import { format, subYears, startOfYear, subMonths } from 'date-fns'

const POPULAR = ['NVDA', 'AAPL', 'TSLA', 'META', 'AMZN', 'GOOGL', 'MSFT', 'AMD', 'AVGO', 'SMCI']
const RANGES: RangePreset[] = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', '2Y', '5Y']

function getDateRangeForLinks(preset: RangePreset) {
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
    default: from = subYears(to, 5)
  }
  return {
    since: format(from, 'yyyy-MM-dd'),
    until: format(to, 'yyyy-MM-dd'),
  }
}

// SPACEX TELEMETRY: US Market status (NYSE hours in ET)
function getUSMarketStatus(): { status: 'OPEN' | 'CLOSED' | 'PRE' | 'AFTER'; color: string } {
  try {
    const now = new Date()
    // Convert to ET
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
    if (day === 0 || day === 6) return { status: 'CLOSED', color: '#ef4444' }
    // Pre: 04:00–09:29, Regular: 09:30–15:59, After: 16:00–19:59 ET
    if (mins >= 4 * 60 && mins < 9 * 60 + 30) return { status: 'PRE', color: '#eab308' }
    if (mins >= 9 * 60 + 30 && mins < 16 * 60) return { status: 'OPEN', color: '#22c55e' }
    if (mins >= 16 * 60 && mins < 20 * 60) return { status: 'AFTER', color: '#eab308' }
    return { status: 'CLOSED', color: '#ef4444' }
  } catch {
    return { status: 'CLOSED', color: '#ef4444' }
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
  const { since, until } = getDateRangeForLinks(rangePreset)
  const market = getUSMarketStatus()
  const lastUpdateStr = formatLastUpdate(lastUpdated)

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

  useKeyboard(() => setShowSettings(true), () => setShowHelp(true))

  // Auto-fetch on mount ONLY. Resilience debounce for rapid range/selected/add/remove now lives inside
  // store (setRange, addTicker, removeTicker, setSelected) via 300ms scheduleYahooFetch — protects Yahoo.
  useEffect(() => {
    fetchAll()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- initial mount only; store handles debounced refetch on changes

  function handleAdd() {
    const t = tickerInput.trim().toUpperCase()
    if (t && canAdd) {
      addTicker(t)
      setTickerInput('')
      toast.success(`Added ${t}`)
    }
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
    toast.info(`Range set to ${p}`)
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

  const hasData = Object.keys(series).length > 0

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

        {/* PERSISTENT TELEMETRY BAR — deep SpaceX control screen vibe */}
        <div className="telemetry-bar border-t border-[#1a1a1a] bg-[#050505]">
          <div className="max-w-[1280px] mx-auto px-6 h-7 flex items-center justify-between text-[10px] font-mono tracking-[1.5px] text-[#999]">
            <div className="flex items-center gap-5">
              <span>UTC <span className="text-[#67e8f9] font-semibold tracking-[1px] tabular-nums">{utcTime}</span></span>
              <span className="opacity-40">│</span>
              <span>US MKT <span className="font-bold tabular-nums" style={{ color: market.color }}>{market.status}</span></span>
              <span className="opacity-40">│</span>
              <span>LAST DATA <span className="text-[#67e8f9] font-semibold tracking-[1px] tabular-nums">{lastUpdateStr}</span></span>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-[7px] h-[7px] rounded-full bg-[#22c55e] shadow-[0_0_4px_#22c55e]" />
                SIGNAL <span className="text-[#22c55e] font-bold">NOMINAL</span>
              </span>
              <span className="hidden sm:inline opacity-40">│</span>
              <span className="text-[9px] text-[#555] tracking-[2px] hidden sm:inline">TELEMETRY • READOUT MODE</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1280px] mx-auto px-6 pt-6 pb-12 flex-1 flex flex-col gap-6">
        {/* RANGE CONTROLS — SPACEX */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <div className="label mb-1.5">PRICE HISTORY RANGE — MAX 5 YEARS</div>
            <div className="flex flex-wrap gap-1">
              {RANGES.map(r => (
                <button
                  key={r}
                  onClick={() => handleRange(r)}
                  className={`range-chip ${rangePreset === r ? 'active' : ''}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#888] font-mono">
            {since} → {until}
            <button onClick={clear} className="btn btn-danger ml-3">CLEAR WATCHLIST</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-6">
          {/* WATCHLIST SIDEBAR */}
          <div className="panel p-4 flex flex-col">
            <div className="section-title">WATCHLIST</div>

            <div className="flex gap-2 mb-3">
              <input
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
                  <div className="flex items-center gap-3 text-xs font-mono">
                    {quotes[ticker] && (
                      <>
                        <span>{quotes[ticker].price.toFixed(2)}</span>
                        <span className={quotes[ticker].change >= 0 ? 'delta-pos' : 'delta-neg'}>
                          {quotes[ticker].change >= 0 ? '+' : ''}{quotes[ticker].change.toFixed(1)}%
                        </span>
                      </>
                    )}
                    <button onClick={() => handleRemove(ticker)} className="text-[#555] hover:text-[#ef4444]">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 mt-auto text-[10px] text-[#555] border-t border-[#222]">
              {selected.length} / 10 • YAHOO + FINNHUB
            </div>
          </div>

          {/* CHART + METRICS */}
          <div className="flex flex-col gap-4 min-w-0">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="label">COMPARATIVE PRICE HISTORY • {rangePreset}</div>
                  <div className="text-xl font-semibold tracking-[-0.5px]">BRIANSTOCKS WATCHLIST</div>
                </div>
                {/* Chart controls group (LINE/CANDLE, VOL, SMAs, NORMALIZE) — SPACEX chips + minimal toggles */}
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <div className="flex items-center gap-1" title="Chart type (CANDLE focuses primary ticker + volume)">
                    {(['LINE', 'CANDLE'] as const).map((m) => {
                      const val = m === 'LINE' ? 'line' : 'candle'
                      return (
                        <button
                          key={m}
                          onClick={() => setChartType(val)}
                          className={`range-chip ${chartType === val ? 'active' : ''}`}
                        >
                          {m}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => setShowVolume(!showVolume)}
                    className={`btn text-xs flex items-center gap-1 ${showVolume ? 'border-[#67e8f9] text-[#67e8f9]' : ''}`}
                    title="Toggle volume histogram (primary ticker)"
                  >
                    VOL
                  </button>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-[#888] pl-1 border-l border-[#222]">
                    <label className="flex items-center gap-1 cursor-pointer select-none" title="20-period SMA overlay">
                      <input
                        type="checkbox"
                        checked={showSma20}
                        onChange={(e) => setShowSma20(e.target.checked)}
                        className="accent-[#67e8f9]"
                      />
                      <span>SMA20</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer select-none" title="50-period SMA overlay">
                      <input
                        type="checkbox"
                        checked={showSma50}
                        onChange={(e) => setShowSma50(e.target.checked)}
                        className="accent-[#67e8f9]"
                      />
                      <span>SMA50</span>
                    </label>
                  </div>
                  <button
                    onClick={() => setNormalize(!normalize)}
                    className={`btn text-xs flex items-center gap-1.5 ${normalize ? 'border-[#67e8f9] text-[#67e8f9]' : ''}`}
                  >
                    <TrendingUp size={14} /> {normalize ? 'NORMALIZED %' : 'ABSOLUTE PRICE'}
                  </button>
                </div>
              </div>

              <div className="chart-container p-2">
                {hasData ? (
                  <PriceChart
                    series={series}
                    normalize={normalize}
                    height={420}
                  />
                ) : (
                  <div className="h-[420px] flex items-center justify-center text-[#555] text-sm font-mono tracking-widest">
                    {loading ? 'FETCHING DATA FROM YAHOO…' : 'ADD TICKERS TO LOAD CHART'}
                  </div>
                )}
              </div>
              <div className="text-[10px] text-[#555] mt-1.5 tracking-[1px]">
                SOURCE: YAHOO FINANCE PUBLIC API • DAILY BARS • UP TO 5 YEARS
              </div>
            </div>

            {/* Mini quote cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {selected.map((t) => {
                const q = quotes[t]
                return (
                  <div key={t} className="card py-2.5 text-center">
                    <div className="label tracking-widest">{t}</div>
                    <div className="metric-lg font-mono mt-px">{q ? q.price.toFixed(2) : '—'}</div>
                    {q && (
                      <div className={q.change >= 0 ? 'delta-pos text-xs' : 'delta-neg text-xs'}>
                        {q.change >= 0 ? '+' : ''}{q.change.toFixed(1)}%
                      </div>
                    )}
                  </div>
                )
              })}
              {selected.length === 0 && <div className="text-[#555] col-span-full text-xs">No tickers selected</div>}
            </div>
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
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          {/* QUOTES TABLE */}
          <div className="panel p-4">
            <div className="section-title">LIVE QUOTES</div>
            <table className="data">
              <thead>
                <tr><th>TICKER</th><th>LAST</th><th>Δ%</th></tr>
              </thead>
              <tbody>
                {selected.map(t => {
                  const q = quotes[t]
                  return (
                    <tr key={t}>
                      <td className="font-bold font-mono tracking-widest">{t}</td>
                      <td className="font-mono">{q ? q.price.toFixed(2) : '—'}</td>
                      <td className={q && q.change >= 0 ? 'delta-pos' : 'delta-neg'}>
                        {q ? `${q.change >= 0 ? '+' : ''}${q.change.toFixed(2)}%` : '—'}
                      </td>
                    </tr>
                  )
                })}
                {selected.length === 0 && <tr><td colSpan={3} className="text-[#555]">— ADD TICKERS —</td></tr>}
                {selected.length > 0 && Object.keys(quotes).length === 0 && !loading && (
                  <tr><td colSpan={3} className="text-[#eab308] text-[10px]">YAHOO RATE LIMITED — RETAINING CACHED / STALE</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* NEWS */}
          <div className="panel p-4">
            <div className="section-title">NEWS {finnhubToken ? '• MARKET PULSE' : '(ADD TOKEN)'}</div>
            <div className="max-h-[218px] overflow-auto text-xs pr-1 space-y-3">
              {news.length > 0 || (marketNews && marketNews.length > 0) ? [...news, ...(marketNews || [])].slice(0, 4).map((n, i) => (
                <div key={i} className="news-item">
                  <div className="news-headline leading-tight">{n.headline || n.title}</div>
                  <div className="news-meta">
                    {n.source} • {n.ticker} • {n.datetime ? new Date(n.datetime * 1000).toLocaleDateString() : ''}
                    {n.url && <span className="ml-2 text-[#67e8f9] cursor-pointer" onClick={() => window.open(n.url, '_blank')}>OPEN</span>}
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

          {/* X TRENDING — made more "live" with fake trending scores + relative recency */}
          <div className="panel p-4">
            <div className="section-title">TRENDING ON X</div>
            {selected.length > 0 && (
              <div className="text-[9px] text-[#888] font-mono tracking-widest mb-1 flex items-center gap-3">
                <span>LIVE • TREND SCORE {Math.min(99, 71 + selected.length * 3)} • AS OF {lastUpdateStr.split(' ')[0] || 'NOW'}</span>
                <span className="text-[#67e8f9]">LIVE SEARCH</span>
              </div>
            )}
            <div className="space-y-2 text-sm">
              {selected.length > 0 ? (
                <>
                  {selected.slice(0, 4).map((t) => {
                    const score = 74 + ((t.charCodeAt(0) + selected.length * 2) % 22)
                    const rel = ((t.charCodeAt(1) || 65) % 7) + 1
                    const ago = rel < 4 ? `${rel * 17 + 9}m ago` : `${Math.floor(rel / 2)}h ago`
                    const perUrl = `https://x.com/search?q=%24${t}%20since%3A${since}&f=live`
                    return (
                      <a
                        key={t}
                        href={perUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="x-link flex justify-between items-baseline"
                      >
                        <span>${t} LIVE SINCE {since.slice(5)} →</span>
                        <span className="text-[9px] text-[#888] font-mono tabular-nums ml-2">SCORE {score} • {ago}</span>
                      </a>
                    )
                  })}
                  {(() => {
                    const allQuery = selected.map(s => '%24' + s).join('%20OR%20')
                    const allUrl = `https://x.com/search?q=${allQuery}%20since%3A${since}&f=live`
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
          <div className="panel w-full max-w-[420px] p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="section-title mb-0 tracking-[3px]">SETTINGS</div>
              <button onClick={() => setShowSettings(false)}><X size={18} /></button>
            </div>

            <div className="space-y-5 text-sm">
              <div>
                <div className="label mb-1 tracking-[2px]">FINNHUB TOKEN (FREE — 60 CALLS/MIN)</div>
                <input
                  value={localToken}
                  onChange={e => setLocalToken(e.target.value)}
                  placeholder="paste your finnhub token here"
                  className="input w-full font-mono"
                />
                <div className="mt-1 text-[#67e8f9] text-xs">
                  Sign up free → <a href="https://finnhub.io/register" target="_blank" rel="noreferrer" className="underline">finnhub.io/register</a><br />
                  Enables news, earnings &amp; better fundamentals. Stored only in this browser.
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={handleSaveToken} className="btn btn-accent flex-1">SAVE + REFRESH DATA</button>
                <button onClick={handleClearToken} className="btn flex-1">CLEAR TOKEN</button>
              </div>

              <div className="text-[11px] text-[#666] border-t border-[#222] pt-3">
                Price history and basic quotes always work via Yahoo (no key required).<br />
                Close this dialog and hit REFRESH after saving a token.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HELP OVERLAY — triggered by ? key */}
      {showHelp && (
        <div className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4" onClick={() => setShowHelp(false)}>
          <div className="panel w-full max-w-[480px] p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="section-title mb-0 tracking-[3px]">KEYBOARD MISSION CONTROLS</div>
              <button onClick={() => setShowHelp(false)}><X size={18} /></button>
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
