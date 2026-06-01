'use client'

import { useMemo } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameMonth, isSameDay, format,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { ScheduledExecution } from '@/hooks/use-maintenance-schedule'

// Horário sempre exibido em Brasília (fecha o ciclo do timezone — armazenamos
// timestamptz com offset fixo -03:00 na criação).
const timeFmt = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
})

const STATUS_DOT: Record<string, string> = {
  assigned:    'bg-amber-500',
  in_progress: 'bg-blue-500',
  concluded:   'bg-green-500',
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface Props {
  month: Date
  executions: ScheduledExecution[]
  onSelect: (ticketId: string) => void
}

export function MaintenanceAgendaCalendar({ month, executions, onSelect }: Props) {
  // Mapa 'YYYY-MM-DD' (em Brasília) → execuções daquele dia.
  const byDay = useMemo(() => {
    const map = new Map<string, ScheduledExecution[]>()
    for (const e of executions) {
      // chave do dia no fuso de Brasília
      const key = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo',
      }).format(new Date(e.scheduled_at))
      const arr = map.get(key) ?? []
      arr.push(e)
      map.set(key, arr)
    }
    return map
  }, [executions])

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
    const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
    const out: Date[] = []
    let d = gridStart
    while (d <= gridEnd) {
      out.push(d)
      d = addDays(d, 1)
    }
    return out
  }, [month])

  const today = new Date()

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Cabeçalho dos dias da semana */}
      <div className="grid grid-cols-7 border-b border-border bg-surface-secondary">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-2 text-center text-xs font-medium text-text-tertiary">
            {w}
          </div>
        ))}
      </div>

      {/* Grade de dias */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const items = byDay.get(key) ?? []
          const inMonth = isSameMonth(day, month)
          const isToday = isSameDay(day, today)

          return (
            <div
              key={key}
              className={cn(
                'min-h-[96px] border-b border-r border-border p-1.5 space-y-1 align-top',
                !inMonth && 'bg-surface-secondary/40',
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'inline-flex items-center justify-center w-6 h-6 text-xs rounded-full',
                    isToday && 'bg-primary text-primary-foreground font-semibold',
                    !isToday && inMonth && 'text-text-primary',
                    !isToday && !inMonth && 'text-text-tertiary',
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {items.map((e) => {
                const who =
                  e.executor_type === 'internal'
                    ? e.internal_user?.name
                    : e.responsible_user?.name
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => onSelect(e.ticket_id)}
                    title={`${e.ticket_title}${who ? ' · ' + who : ''}`}
                    className="w-full text-left rounded-md px-1.5 py-1 bg-surface-secondary hover:bg-muted border border-border transition-colors"
                  >
                    <span className="flex items-center gap-1">
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', STATUS_DOT[e.status] ?? 'bg-gray-400')} />
                      <span className="text-[10px] font-medium text-text-secondary shrink-0">
                        {timeFmt.format(new Date(e.scheduled_at))}
                      </span>
                    </span>
                    <span className="block text-[11px] text-text-primary truncate leading-tight">
                      {e.ticket_title}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function formatMonthLabel(month: Date): string {
  const label = format(month, "MMMM 'de' yyyy", { locale: ptBR })
  return label.charAt(0).toUpperCase() + label.slice(1)
}
