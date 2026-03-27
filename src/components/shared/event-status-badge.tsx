import { cn } from '@/lib/utils'
import type { EventStatus } from '@/types/database.types'

const STATUS_CONFIG: Record<EventStatus, { label: string; className: string }> = {
  pending:     { label: 'Pendente',      className: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed:   { label: 'Confirmado',    className: 'bg-blue-50 text-blue-700 border-blue-200' },
  preparing:   { label: 'Em Preparo',    className: 'bg-purple-50 text-purple-700 border-purple-200' },
  in_progress: { label: 'Em Andamento',  className: 'bg-green-50 text-green-700 border-green-200' },
  finished:    { label: 'Finalizado',    className: 'bg-gray-100 text-gray-600 border-gray-200' },
  post_event:  { label: 'Pós-Evento',   className: 'bg-gray-100 text-gray-500 border-gray-200' },
}

const DOT_COLOR: Record<EventStatus, string> = {
  pending:     'bg-amber-500',
  confirmed:   'bg-blue-500',
  preparing:   'bg-purple-500',
  in_progress: 'bg-green-500',
  finished:    'bg-gray-400',
  post_event:  'bg-gray-400',
}

interface EventStatusBadgeProps {
  status: EventStatus
  size?: 'sm' | 'md'
  showDot?: boolean
  className?: string
}

export function EventStatusBadge({
  status,
  size = 'md',
  showDot = true,
  className,
}: EventStatusBadgeProps) {
  const config = STATUS_CONFIG[status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        config.className,
        className
      )}
    >
      {showDot && (
        <span className={cn('size-1.5 rounded-full', DOT_COLOR[status])} />
      )}
      {config.label}
    </span>
  )
}

// Exporta a config para uso em outros componentes (ex: calendário, selects)
export { STATUS_CONFIG, DOT_COLOR }
