import type { ChecklistRecurrence } from '@/types/database.types'

/**
 * Calcula a próxima data de geração a partir da frequência e das configurações
 * de dia/horário de uma regra de recorrência.
 *
 * Utilizado tanto no hook client-side (use-checklist-recurrences.ts)
 * quanto no cron server-side (generate-recurring-checklists/route.ts).
 */
export function calcNextGenerationAt(
  frequency: ChecklistRecurrence['frequency'],
  dayOfWeek?: number[] | null,
  dayOfMonth?: number | null,
  timeOfDay = '08:00',
): string {
  const now = new Date()
  const [h, m] = timeOfDay.slice(0, 5).split(':').map(Number)
  let next = new Date(now)

  if (frequency === 'daily') {
    next.setDate(now.getDate() + 1)
  } else if (frequency === 'weekly' || frequency === 'biweekly') {
    const targetDay = dayOfWeek?.[0] ?? 1   // segunda-feira default
    const gap = (targetDay - now.getDay() + 7) % 7 || 7
    next.setDate(now.getDate() + gap)
    if (frequency === 'biweekly') next.setDate(next.getDate() + 7)
  } else if (frequency === 'monthly') {
    const dom = dayOfMonth ?? 1
    next = new Date(now.getFullYear(), now.getMonth(), dom)
    if (next <= now) next.setMonth(next.getMonth() + 1)
  }

  next.setHours(h, m, 0, 0)
  return next.toISOString()
}
