import { cn } from '@/lib/utils'
import type { MaintenanceType } from '@/types/database.types'

interface Props {
  type: MaintenanceType
  className?: string
}

export const MAINTENANCE_TYPE_CONFIG: Record<MaintenanceType, { label: string; pill: string; dot: string }> = {
  emergency: {
    label: 'Emergencial',
    pill: 'badge-red border',
    dot:  'bg-red-500',
  },
  punctual: {
    label: 'Pontual',
    pill: 'badge-amber border',
    dot:  'bg-amber-500',
  },
  recurring: {
    label: 'Recorrente',
    pill: 'badge-green border',
    dot:  'bg-green-500',
  },
}

export function MaintenanceTypeBadge({ type, className }: Props) {
  const cfg = MAINTENANCE_TYPE_CONFIG[type]
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
      cfg.pill, className
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', cfg.dot)} />
      {cfg.label}
    </span>
  )
}
