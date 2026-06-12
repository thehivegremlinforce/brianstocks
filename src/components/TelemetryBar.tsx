export type MarketStatus = 'OPEN' | 'CLOSED' | 'PRE' | 'AFTER'

interface TelemetryBarProps {
  utcTime: string
  marketStatus: MarketStatus
  lastUpdateStr: string
  loading?: boolean
}

const STATUS_CLASS: Record<MarketStatus, string> = {
  OPEN: 'status-open',
  CLOSED: 'status-closed',
  PRE: 'status-pre',
  AFTER: 'status-after',
}

export function TelemetryBar({ utcTime, marketStatus, lastUpdateStr, loading }: TelemetryBarProps) {
  return (
    <div className="telemetry-bar border-t border-[#1a1a1a] bg-[#050505]">
      <div className="max-w-[1280px] mx-auto px-6 h-7 flex items-center justify-between text-[10px] font-mono tracking-[1.5px] text-[#999]">
        <div className="flex items-center gap-5">
          <span>
            UTC{' '}
            <span className="text-[#67e8f9] font-semibold tracking-[1px] tabular-nums">{utcTime}</span>
          </span>
          <span className="opacity-40">│</span>
          <span>
            US MKT{' '}
            <span className={`font-bold tabular-nums ${STATUS_CLASS[marketStatus]}`}>{marketStatus}</span>
          </span>
          <span className="opacity-40">│</span>
          <span>
            LAST DATA{' '}
            <span className="text-[#67e8f9] font-semibold tracking-[1px] tabular-nums">{lastUpdateStr}</span>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span
              className={`inline-block w-[7px] h-[7px] rounded-full shadow-[0_0_4px_var(--green)] ${loading ? 'status-pulse' : 'bg-[var(--green)]'}`}
            />
            SIGNAL{' '}
            <span className="status-open font-bold">{loading ? 'SYNC' : 'NOMINAL'}</span>
          </span>
          <span className="hidden sm:inline opacity-40">│</span>
          <span className="text-[9px] text-[#555] tracking-[2px] hidden sm:inline">TELEMETRY • READOUT MODE</span>
        </div>
      </div>
    </div>
  )
}