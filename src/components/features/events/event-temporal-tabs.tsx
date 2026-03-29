'use client'

import { useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { TabKey } from '@/hooks/use-events'

interface EventTemporalTabsProps {
  active: TabKey
  counts: Record<TabKey, number> | undefined
  isLoading?: boolean
  onTabChange: (tab: TabKey) => void
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'week',  label: 'Semana' },
  { key: 'month', label: 'Mês' },
  { key: 'all',   label: 'Todos' },
]

export function EventTemporalTabs({
  active,
  counts,
  isLoading,
  onTabChange,
}: EventTemporalTabsProps) {
  const listRef  = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  // Scroll aba ativa para o centro no mobile ao montar
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [active])

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label="Filtrar eventos por período"
      className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5"
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active
        const count    = counts?.[tab.key]

        return (
          <button
            key={tab.key}
            ref={isActive ? activeRef : undefined}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.key)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-1.5',
              'text-sm font-medium transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? 'bg-interactive-primary text-white shadow-sm'
                : 'bg-transparent text-text-secondary border border-border-default hover:bg-surface-secondary hover:text-text-primary'
            )}
          >
            {tab.label}
            {!isLoading && count !== undefined && (
              <span
                className={cn(
                  'min-w-[20px] rounded-full px-1.5 py-0 text-xs font-semibold tabular-nums text-center',
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-surface-tertiary text-text-primary'
                )}
              >
                {count > 999 ? '999+' : count}
              </span>
            )}
            {isLoading && (
              <span className="h-4 w-8 rounded-full skeleton-shimmer" />
            )}
          </button>
        )
      })}
    </div>
  )
}
