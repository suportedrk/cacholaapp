'use client'

import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Zap, Wrench, RefreshCw, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HistoryOrderItem } from '@/hooks/use-maintenance-history'
import { calcResolutionHours, formatResolutionTime } from '@/hooks/use-maintenance-history'

// ─────────────────────────────────────────────────────────────
// TYPE CONFIG
// ─────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  emergency: { icon: Zap,       label: 'Emergencial', dot: 'bg-red-500',    text: 'text-red-600 dark:text-red-400'   },
  punctual:  { icon: Wrench,    label: 'Pontual',     dot: 'bg-amber-500',  text: 'text-amber-600 dark:text-amber-400' },
  recurring: { icon: RefreshCw, label: 'Recorrente',  dot: 'bg-green-500',  text: 'text-green-600 dark:text-green-400' },
  preventive:{ icon: Shield,    label: 'Preventiva',  dot: 'bg-blue-500',   text: 'text-blue-600 dark:text-blue-400'  },
} as const

// ─────────────────────────────────────────────────────────────
// GROUP BY MONTH
// ─────────────────────────────────────────────────────────────
function groupByMonth(items: HistoryOrderItem[]): Map<string, HistoryOrderItem[]> {
  const map = new Map<string, HistoryOrderItem[]>()
  for (const item of items) {
    const key = item.completed_at
      ? format(parseISO(item.completed_at), 'MMMM yyyy', { locale: ptBR })
      : 'Sem data'
    const group = map.get(key) ?? []
    group.push(item)
    map.set(key, group)
  }
  return map
}

// ─────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────
export function HistoryTimelineSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      <div className="h-5 w-32 skeleton-shimmer rounded" />
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="mt-1 w-3 h-3 rounded-full skeleton-shimmer shrink-0" />
          <div className="flex-1 rounded-xl border border-border p-3 space-y-2">
            <div className="h-4 w-2/3 skeleton-shimmer rounded" />
            <div className="h-3 w-1/3 skeleton-shimmer rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SINGLE ITEM
// ─────────────────────────────────────────────────────────────
function TimelineItem({ item, isLast }: { item: HistoryOrderItem; isLast: boolean }) {
  const cfg        = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.punctual
  const Icon       = cfg.icon
  const resHours   = calcResolutionHours(item.created_at, item.completed_at)
  const completedDate = item.completed_at
    ? format(parseISO(item.completed_at), "dd 'de' MMM 'às' HH:mm", { locale: ptBR })
    : null

  return (
    <div className="flex gap-3 group">
      {/* Dot + connector */}
      <div className="flex flex-col items-center shrink-0">
        <div className={cn('mt-1 w-3 h-3 rounded-full ring-2 ring-background', cfg.dot)} />
        {!isLast && <div className="flex-1 w-0.5 bg-border mt-1 min-h-[2.5rem]" />}
      </div>

      {/* Card */}
      <div className="flex-1 rounded-xl border border-border bg-card p-3 mb-3 hover:border-border-strong transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Icon className={cn('w-3.5 h-3.5 shrink-0', cfg.text)} />
            <span className="text-sm font-medium text-foreground truncate">{item.title}</span>
          </div>
          {resHours !== null && (
            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
              {formatResolutionTime(resHours)}
            </span>
          )}
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {item.sector && <span>{item.sector.name}</span>}
          {item.supplier && (
            <span className="flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
              {item.supplier.company_name}
            </span>
          )}
          {completedDate && (
            <span className="flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
              {completedDate}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
interface HistoryTimelineProps {
  items: HistoryOrderItem[]
}

export function HistoryTimeline({ items }: HistoryTimelineProps) {
  const groups = groupByMonth(items)

  return (
    <div className="space-y-4">
      {Array.from(groups.entries()).map(([monthLabel, groupItems]) => (
        <div key={monthLabel}>
          {/* Month header */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 capitalize">
            {monthLabel}
          </p>

          {/* Items */}
          {groupItems.map((item, idx) => (
            <TimelineItem
              key={item.id}
              item={item}
              isLast={idx === groupItems.length - 1}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
