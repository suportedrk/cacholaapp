import { cn } from '@/lib/utils'
import type { MaintenanceType } from '@/types/database.types'

interface Props {
  type: MaintenanceType
  className?: string
}

export const MAINTENANCE_TYPE_CONFIG: Record<MaintenanceType, { label: string; pill: string; dot: string }> = {
  emergency: {
    label: 'Emergencial',
    pill: 'bg-red-50 text-red-700 border border-red-200',
    dot:  'bg-red-500',
  },
  punctual: {
    label: 'Pontual',
    pill: 'bg-amber-50 text-amber-700 border border-amber-200',
    dot:  'bg-amber-500',
  },
  recurring: {
    label: 'Recorrente',
    pill: 'bg-green-50 text-green-700 border border-green-200',
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
