import { TrendingUp } from 'lucide-react'
import type { RangePreset } from '../store/watchlistStore'

interface ChartCommandBarProps {
  rangePreset: RangePreset
  ranges: RangePreset[]
  onRangeChange: (preset: RangePreset) => void
  chartType: 'line' | 'candle'
  onChartTypeChange: (type: 'line' | 'candle') => void
  showVolume: boolean
  onVolumeToggle: () => void
  showSma20: boolean
  showSma50: boolean
  onSmaToggle: (which: 'sma20' | 'sma50', value: boolean) => void
  normalize: boolean
  onNormalizeToggle: () => void
  selectedCount: number
  onClear: () => void
  dateRangeLabel?: string
}

export function ChartCommandBar({
  rangePreset,
  ranges,
  onRangeChange,
  chartType,
  onChartTypeChange,
  showVolume,
  onVolumeToggle,
  showSma20,
  showSma50,
  onSmaToggle,
  normalize,
  onNormalizeToggle,
  selectedCount,
  onClear,
  dateRangeLabel,
}: ChartCommandBarProps) {
  function handleClear() {
    if (selectedCount === 0) return
    if (window.confirm(`Clear all ${selectedCount} ticker(s) from watchlist?`)) {
      onClear()
    }
  }

  return (
    <div className="chart-command-bar" role="toolbar" aria-label="Chart controls">
      <div className="chart-command-bar__section">
        <span className="chart-command-bar__label">RANGE</span>
        <div className="chart-command-bar__chips">
          {ranges.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => onRangeChange(r)}
              className={`range-chip ${rangePreset === r ? 'active' : ''}`}
              aria-pressed={rangePreset === r}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-command-bar__divider" aria-hidden />

      <div className="chart-command-bar__section">
        <span className="chart-command-bar__label">MODE</span>
        <div className="chart-command-bar__chips">
          {(['LINE', 'CANDLE'] as const).map((m) => {
            const val = m === 'LINE' ? 'line' : 'candle'
            return (
              <button
                key={m}
                type="button"
                onClick={() => onChartTypeChange(val)}
                className={`range-chip ${chartType === val ? 'active' : ''}`}
                aria-pressed={chartType === val}
                title="Chart type (CANDLE focuses primary ticker + volume)"
              >
                {m}
              </button>
            )
          })}
        </div>
      </div>

      <div className="chart-command-bar__divider" aria-hidden />

      <div className="chart-command-bar__section chart-command-bar__toggles">
        <button
          type="button"
          onClick={onVolumeToggle}
          className={`btn text-xs ${showVolume ? 'chart-command-bar__active' : ''}`}
          aria-pressed={showVolume}
          title="Toggle volume histogram (primary ticker)"
        >
          VOL
        </button>

        <label className="chart-command-bar__check" title="20-period SMA overlay">
          <input
            type="checkbox"
            checked={showSma20}
            onChange={(e) => onSmaToggle('sma20', e.target.checked)}
            className="accent-[#67e8f9]"
          />
          <span>SMA20</span>
        </label>

        <label className="chart-command-bar__check" title="50-period SMA overlay">
          <input
            type="checkbox"
            checked={showSma50}
            onChange={(e) => onSmaToggle('sma50', e.target.checked)}
            className="accent-[#67e8f9]"
          />
          <span>SMA50</span>
        </label>

        <button
          type="button"
          onClick={onNormalizeToggle}
          className={`btn text-xs flex items-center gap-1.5 ${normalize ? 'chart-command-bar__active' : ''}`}
          aria-pressed={normalize}
          disabled={chartType === 'candle'}
          title={chartType === 'candle' ? 'Normalize unavailable in candle mode' : undefined}
        >
          <TrendingUp size={14} />
          {normalize ? 'NORMALIZED %' : 'ABSOLUTE'}
        </button>
      </div>

      <div className="chart-command-bar__spacer" />

      <div className="chart-command-bar__section chart-command-bar__meta">
        {dateRangeLabel && <span className="chart-command-bar__dates">{dateRangeLabel}</span>}
        <button
          type="button"
          onClick={handleClear}
          className="btn btn-danger text-xs"
          disabled={selectedCount === 0}
        >
          CLEAR WATCHLIST
        </button>
      </div>
    </div>
  )
}