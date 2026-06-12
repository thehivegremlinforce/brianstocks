import { useEffect } from 'react'
import { useWatchlistStore } from '../store/watchlistStore'
import type { RangePreset } from '../store/watchlistStore'

const RANGE_KEYS: Record<string, RangePreset> = {
  '1': '1D', '2': '5D', '3': '1M', '4': '3M',
  '5': '6M', '6': 'YTD', '7': '1Y', '8': '2Y', '9': '5Y',
}

export function useKeyboard(onOpenSettings: () => void, onOpenHelp?: () => void) {
  const fetchAll = useWatchlistStore(s => s.fetchAll)
  const setRange = useWatchlistStore(s => s.setRange)
  const clear = useWatchlistStore(s => s.clear)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const key = e.key.toLowerCase()

      if (key === 'r') {
        e.preventDefault()
        fetchAll()
      }
      if (key === '/') {
        e.preventDefault()
        const input = document.querySelector('input[placeholder*="TICKER"]') as HTMLInputElement
        input?.focus()
        input?.select()
      }
      if (key === 's') {
        e.preventDefault()
        onOpenSettings()
      }
      if (key === '?') {
        e.preventDefault()
        onOpenHelp?.()
      }
      if (key === 'p') {
        e.preventDefault()
        const input = document.querySelector('input[placeholder*="TICKER"]') as HTMLInputElement
        input?.focus()
        input?.select()
      }
      if (key === 'c' && e.metaKey) {
        e.preventDefault()
        clear()
      }
      if (RANGE_KEYS[key]) {
        e.preventDefault()
        setRange(RANGE_KEYS[key])
      }
      if (key === 'escape') {
        // settings close is handled in modal
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [fetchAll, setRange, clear, onOpenSettings, onOpenHelp])
}
