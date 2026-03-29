'use client'

import { useMemo } from 'react'
import { format, isToday, isTomorrow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface EventDayGroupProps {
  /** 'YYYY-MM-DD' */
  date: string
  count: number
}

export function EventDayGroup({ date, count }: EventDayGroupProps) {
  const label = useMemo(() => {
    const d = parseISO(date)
    if (isToday(d))    return 'Hoje'
    if (isTomorrow(d)) return 'Amanhã'
    return format(d, "EEEE, d 'de' MMMM", { locale: ptBR })
  }, [date])

  // Capitaliza primeira letra
  const displayLabel = label.charAt(0).toUpperCase() + label.slice(1)

  return (
    <div className="flex items-center gap-3 my-2">
      <div className="h-px flex-1 bg-border-default" />
      <span className="text-xs font-medium text-text-secondary whitespace-nowrap">
        {displayLabel}
        {' '}
        <span className="text-text-tertiary">
          · {count} festa{count !== 1 ? 's' : ''}
        </span>
      </span>
      <div className="h-px flex-1 bg-border-default" />
    </div>
  )
}
