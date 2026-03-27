import { cn } from '@/lib/utils'
import type { MaintenanceStatus } from '@/types/database.types'

interface Props {
  status: MaintenanceStatus
  className?: string
}

export const MAINTENANCE_STATUS_CONFIG: Record<MaintenanceStatus, { label: string; pill: string }> = {
  open:           { label: 'Aberta',           pill: 'bg-blue-50 text-blue-700 border border-blue-200' },
  in_progress:    { label: 'Em Andamento',     pill: 'bg-purple-50 text-purple-700 border border-purple-200' },
  waiting_parts:  { label: 'Aguardando Peças', pill: 'bg-amber-50 text-amber-700 border border-amber-200' },
  completed:      { label: 'Concluída',        pill: 'bg-green-50 text-green-700 border border-green-200' },
  cancelled:      { label: 'Cancelada',        pill: 'bg-gray-100 text-gray-500 border border-gray-200' },
}

export const MAINTENANCE_PRIORITY_CONFIG: Record<string, { label: string; pill: string }> = {
  critical: { label: 'Crítica', pill: 'bg-red-100 text-red-700 border border-red-300' },
  high:     { label: 'Alta',    pill: 'bg-orange-50 text-orange-700 border border-orange-200' },
  medium:   { label: 'Média',   pill: 'bg-amber-50 text-amber-600 border border-amber-200' },
  low:      { label: 'Baixa',   pill: 'bg-gray-50 text-gray-500 border border-gray-200' },
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
