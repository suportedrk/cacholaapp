import {
  startOfMonth,
  endOfMonth,
  subMonths,
  subDays,
  format,
} from 'date-fns'

export type VendasPeriodKey = 'mes_atual' | 'mes_anterior' | '3m' | '6m' | '12m'

export interface VendasPeriod {
  key:       VendasPeriodKey
  label:     string
  startDate: string  // ISO "YYYY-MM-DD"
  endDate:   string
  prevStart: string
  prevEnd:   string
}

function iso(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

export function buildVendasPeriods(): VendasPeriod[] {
  const today = new Date()

  const mesAtualStart = startOfMonth(today)
  const mesAtualEnd   = today
  // Prev: same number of days elapsed in the previous month
  const daysElapsed   = today.getDate() - 1
  const prevMonthSameDay = subMonths(today, 1)
  const mesAtualPrevStart = startOfMonth(prevMonthSameDay)
  const mesAtualPrevEnd   = new Date(
    mesAtualPrevStart.getFullYear(),
    mesAtualPrevStart.getMonth(),
    Math.min(daysElapsed + 1, endOfMonth(mesAtualPrevStart).getDate()),
  )

  const mesAnteriorStart = startOfMonth(subMonths(today, 1))
  const mesAnteriorEnd   = subDays(startOfMonth(today), 1)
  const mesAnteriorPrevStart = startOfMonth(subMonths(today, 2))
  const mesAnteriorPrevEnd   = subDays(startOfMonth(subMonths(today, 1)), 1)

  return [
    {
      key:       'mes_atual',
      label:     'Mês atual',
      startDate: iso(mesAtualStart),
      endDate:   iso(mesAtualEnd),
      prevStart: iso(mesAtualPrevStart),
      prevEnd:   iso(mesAtualPrevEnd),
    },
    {
      key:       'mes_anterior',
      label:     'Mês anterior',
      startDate: iso(mesAnteriorStart),
      endDate:   iso(mesAnteriorEnd),
      prevStart: iso(mesAnteriorPrevStart),
      prevEnd:   iso(mesAnteriorPrevEnd),
    },
    {
      key:       '3m',
      label:     '3M',
      startDate: iso(subMonths(today, 3)),
      endDate:   iso(today),
      prevStart: iso(subMonths(today, 6)),
      prevEnd:   iso(subDays(subMonths(today, 3), 1)),
    },
    {
      key:       '6m',
      label:     '6M',
      startDate: iso(subMonths(today, 6)),
      endDate:   iso(today),
      prevStart: iso(subMonths(today, 12)),
      prevEnd:   iso(subDays(subMonths(today, 6), 1)),
    },
    {
      key:       '12m',
      label:     '12M',
      startDate: iso(subMonths(today, 12)),
      endDate:   iso(today),
      prevStart: iso(subMonths(today, 24)),
      prevEnd:   iso(subDays(subMonths(today, 12), 1)),
    },
  ]
}
