import { cn } from '@/lib/utils'
import type { EventStatus } from '@/types/database.types'

const STATUS_CONFIG: Record<EventStatus, { label: string; className: string }> = {
  pending:     { label: 'Pendente',     className: 'badge-amber' },
  confirmed:   { label: 'Confirmado',   className: 'badge-blue' },
  preparing:   { label: 'Em Preparo',   className: 'badge-purple' },
  in_progress: { label: 'Em Andamento', className: 'badge-green' },
  finished:    { label: 'Finalizado',   className: 'badge-gray' },
  post_event:  { label: 'Pós-Evento',   className: 'badge-gray' },
  lost:        { label: 'Perdido',      className: 'badge-gray' },
}

const DOT_COLOR: Record<EventStatus, string> = {
  pending:     'bg-amber-500',
  confirmed:   'bg-blue-500',
  preparing:   'bg-purple-500',
  in_progress: 'bg-green-500',
  finished:    'bg-gray-400',
  post_event:  'bg-gray-400',
  lost:        'bg-gray-300',
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
