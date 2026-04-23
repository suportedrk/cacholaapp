import type { CalendarEvent } from '@/hooks/use-dashboard'
import type { CalendarPreReserva } from '@/types/pre-reservas'
import type { SanitizedEvent } from './types'

/**
 * Remove TODOS os campos sensíveis e retorna apenas o mínimo necessário
 * para renderizar disponibilidade ao cliente (sem nome, contato, valor, etc).
 *
 * CAMPOS PROIBIDOS (não passam daqui):
 * - client_name, birthday_person, owner_name, title
 * - client_contact, description
 * - deal_amount, ploomes_url, stage_name, status
 */
export function sanitizeEventsForExport(
  events: CalendarEvent[],
  preReservas: CalendarPreReserva[],
): SanitizedEvent[] {
  const fromEvents: SanitizedEvent[] = events.map((e) => ({
    id: e.id,
    date: e.date,
    startTime: formatTime(e.start_time),
    endTime: formatTime(e.end_time),
    status: 'ocupado' as const,
  }))

  const fromPreReservas: SanitizedEvent[] = preReservas.map((p) => ({
    id: p.id,
    date: p.date,
    startTime: formatTime(p.start_time),
    endTime: formatTime(p.end_time),
    status: 'reservado' as const,
  }))

  return [...fromEvents, ...fromPreReservas]
}

function formatTime(time: string | null | undefined): string {
  if (!time) return ''
  const [h, m] = time.split(':')
  return `${h}h${m ?? '00'}`
}
