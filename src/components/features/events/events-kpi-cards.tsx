'use client'

import { cn } from '@/lib/utils'
import type { TabKey } from '@/hooks/use-events'

interface KpiCardProps {
  value: string | number
  label: string
  sub?: string
  onClick?: () => void
  variant?: 'default' | 'warning' | 'success'
  isLoading?: boolean
}

function KpiCard({ value, label, sub, onClick, variant = 'default', isLoading }: KpiCardProps) {
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      onClick={onClick}
      className={cn(
        'flex flex-col gap-1 rounded-xl p-4 text-left',
        'bg-surface-secondary',
        onClick && 'cursor-pointer transition-all duration-150 hover:bg-surface-tertiary active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        variant === 'warning' && 'border border-amber-200 dark:border-amber-900',
        variant === 'success' && 'border border-green-200 dark:border-green-900',
        variant === 'default' && 'border border-transparent'
      )}
    >
      {isLoading ? (
        <>
          <div className="h-7 w-12 skeleton-shimmer rounded" />
          <div className="h-3.5 w-16 skeleton-shimmer rounded mt-1" />
        </>
      ) : (
        <>
          <span className={cn(
            'text-2xl font-medium tabular-nums leading-none',
            variant === 'warning' && 'text-amber-600 dark:text-amber-400',
            variant === 'success' && 'text-green-600 dark:text-green-400',
            variant === 'default' && 'text-text-primary'
          )}>
            {value}
          </span>
          <span className="text-[13px] text-text-secondary leading-tight">{label}</span>
          {sub && (
            <span className="text-[11px] text-text-tertiary leading-tight">{sub}</span>
          )}
        </>
      )}
    </Tag>
  )
}

interface EventsKpiCardsProps {
  tabCounts:    Record<TabKey, number> | undefined
  checklistPct: number | undefined
  pendingCount: number | undefined
  isLoading:    boolean
  onTabChange:  (tab: TabKey) => void
}

export function EventsKpiCards({
  tabCounts,
  checklistPct,
  pendingCount,
  isLoading,
  onTabChange,
}: EventsKpiCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      <KpiCard
        value={tabCounts?.today ?? '—'}
        label="Festas hoje"
        onClick={() => onTabChange('today')}
        isLoading={isLoading}
      />
      <KpiCard
        value={tabCounts?.week ?? '—'}
        label="Esta semana"
        onClick={() => onTabChange('week')}
        isLoading={isLoading}
      />
      <KpiCard
        value={checklistPct !== undefined ? `${checklistPct}%` : '—'}
        label="Checklists"
        sub="média da semana"
        variant={
          checklistPct === undefined ? 'default'
          : checklistPct >= 80 ? 'success'
          : checklistPct >= 50 ? 'default'
          : 'warning'
        }
        isLoading={isLoading}
      />
      <KpiCard
        value={pendingCount ?? '—'}
        label="Sem checklist"
        sub="próximos 7 dias"
        variant={pendingCount ? 'warning' : 'default'}
        onClick={pendingCount ? () => onTabChange('week') : undefined}
        isLoading={isLoading}
      />
    </div>
  )
}
