import { subMonths, subDays, format } from 'date-fns'

export interface BIPeriodPrev {
  prevStart: string  // ISO "YYYY-MM-DD"
  prevEnd:   string
}

/**
 * Computes the "previous period" date range for a given BI period length.
 * Previous period = same-length window immediately before the current period start.
 *
 * Returns null for "Tudo" (months === 24) — no delta badge shown in that case.
 */
export function buildBIPrevRange(months: number): BIPeriodPrev | null {
  if (months === 24) return null
  const today = new Date()
  return {
    prevStart: format(subMonths(today, months * 2), 'yyyy-MM-dd'),
    prevEnd:   format(subDays(subMonths(today, months), 1), 'yyyy-MM-dd'),
  }
}
