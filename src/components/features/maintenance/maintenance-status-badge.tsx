import { cn } from '@/lib/utils'
import type { MaintenanceStatus } from '@/types/database.types'

interface Props {
  status: MaintenanceStatus
  className?: string
}

export const MAINTENANCE_STATUS_CONFIG: Record<MaintenanceStatus, { label: string; pill: string }> = {
  open:           { label: 'Aberta',           pill: 'badge-blue border' },
  in_progress:    { label: 'Em Andamento',     pill: 'badge-purple border' },
  waiting_parts:  { label: 'Aguardando Peças', pill: 'badge-amber border' },
  completed:      { label: 'Concluída',        pill: 'badge-green border' },
  cancelled:      { label: 'Cancelada',        pill: 'badge-gray border' },
}

export const MAINTENANCE_PRIORITY_CONFIG: Record<string, { label: string; pill: string }> = {
  critical: { label: 'Crítica', pill: 'badge-red border' },
  high:     { label: 'Alta',    pill: 'badge-orange border' },
  medium:   { label: 'Média',   pill: 'badge-amber border' },
  low:      { label: 'Baixa',   pill: 'badge-gray border' },
}

export function MaintenanceStatusBadge({ status, className }: Props) {
  const cfg = MAINTENANCE_STATUS_CONFIG[status]
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      cfg.pill, className
    )}>
      {cfg.label}
    </span>
  )
}

export function MaintenancePriorityBadge({ priority, className }: { priority: string; className?: string }) {
  const cfg = MAINTENANCE_PRIORITY_CONFIG[priority] ?? MAINTENANCE_PRIORITY_CONFIG.medium
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
      cfg.pill, className
    )}>
      {cfg.label}
    </span>
  )
}
