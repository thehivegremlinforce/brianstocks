import { subYears, subMonths, startOfYear, format } from 'date-fns'
import type { RangePreset } from '../types/market'

export function getRangeDates(preset: RangePreset): { from: Date; to: Date } {
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
    case '5Y':
    default: from = subYears(to, 5); break
  }
  return { from, to }
}

export function getDateRangeStrings(preset: RangePreset): { since: string; until: string } {
  const { from, to } = getRangeDates(preset)
  return {
    since: format(from, 'yyyy-MM-dd'),
    until: format(to, 'yyyy-MM-dd'),
  }
}