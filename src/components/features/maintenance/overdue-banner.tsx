'use client'

import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOverdueOrders } from '@/hooks/use-maintenance'
import type { MaintenanceFilters } from '@/hooks/use-maintenance'

// ─────────────────────────────────────────────────────────────
// OVERDUE BANNER
// Non-dismissible — persists while there are overdue orders
// ─────────────────────────────────────────────────────────────
interface Props {
  onViewOverdue: (filters: Partial<MaintenanceFilters>) => void
}

export function OverdueBanner({ onViewOverdue }: Props) {
  const { data } = useOverdueOrders()

  if (!data || data.count === 0) return null

  const { count, maxDaysOverdue } = data

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 rounded-lg p-4',
        'border-l-4 border-red-500',
        'bg-status-error-bg text-status-error-text',
      )}
    >
      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">
          {count === 1
            ? '1 ordem está atrasada!'
            : `${count} ordens estão atrasadas!`}
        </p>
        {maxDaysOverdue > 0 && (
          <p className="text-xs mt-0.5 opacity-80">
            A mais atrasada está {maxDaysOverdue} {maxDaysOverdue === 1 ? 'dia' : 'dias'} além do prazo.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onViewOverdue({ status: ['open', 'in_progress', 'waiting_parts'] })}
        className="shrink-0 text-xs font-semibold underline underline-offset-2 hover:no-underline transition-all"
      >
        Ver atrasadas
      </button>
    </div>
  )
}
