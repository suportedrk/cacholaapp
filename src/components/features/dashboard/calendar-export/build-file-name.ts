import { format } from 'date-fns'
import type { ExportPeriod } from './types'

export function buildExportFileName(unitName: string, period: ExportPeriod): string {
  const slug = unitName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')

  const ref = period.referenceDate

  switch (period.viewType) {
    case 'month':
      return `calendario-cachola-${slug}-${format(ref, 'yyyy-MM')}.png`
    case 'week': {
      const weekNum = Math.ceil(ref.getDate() / 7)
      return `calendario-cachola-${slug}-${format(ref, 'yyyy-MM')}-semana-${weekNum}.png`
    }
    case 'day':
      return `calendario-cachola-${slug}-${format(ref, 'yyyy-MM-dd')}.png`
  }
}
