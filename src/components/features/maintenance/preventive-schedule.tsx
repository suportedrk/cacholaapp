'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronRight, Shield } from 'lucide-react'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import { useUpcomingPreventives } from '@/hooks/use-maintenance'

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function formatFrequency(plan: { frequency?: string; interval?: number } | null): string {
  if (!plan) return ''
  const { frequency, interval = 1 } = plan
  const labels: Record<string, string> = {
    monthly:    interval === 1 ? 'Mensal'    : `A cada ${interval} meses`,
    quarterly:  'Trimestral',
    semiannual: 'Semestral',
    annual:     'Anual',
    // Legacy from recurrence_rule
    daily:      'Diário',
    weekly:     'Semanal',
  }
  return labels[frequency ?? ''] ?? (interval ? `A cada ${interval} meses` : '')
}

function countdownInfo(nextDueDateStr: string | null | undefined): {
  days: number
  label: string
  color: string
} {
  if (!nextDueDateStr) return { days: Infinity, label: '—', color: 'text-muted-foreground' }
  const days = differenceInCalendarDays(parseISO(nextDueDateStr), new Date())
  if (days < 0) {
    return {
      days,
      label: `atrasada ${Math.abs(days)} dias`,
      color: 'text-red-600 dark:text-red-400 font-semibold',
    }
  }
  if (days === 0) {
    return { days, label: 'hoje', color: 'text-red-600 dark:text-red-400 font-semibold' }
  }
  if (days <= 7)  return { days, label: `em ${days} dias`, color: 'text-red-500 dark:text-red-400 font-medium' }
  if (days <= 14) return { days, label: `em ${days} dias`, color: 'text-amber-600 dark:text-amber-400 font-medium' }
  return { days, label: `em ${days} dias`, color: 'text-green-600 dark:text-green-400' }
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export function PreventiveSchedule() {
  const { data: items = [], isLoading } = useUpcomingPreventives()

  // Auto-expand if any item due within 14 days
  const shouldAutoExpand = useMemo(() => {
    return items.some((item) => {
      const d = item.preventive_plan?.next_due_date
      if (!d) return false
      return differenceInCalendarDays(parseISO(d), new Date()) <= 14
    })
  }, [items])

  const [expanded, setExpanded] = useState<boolean | null>(null)

  // Use auto-expand on first render (null = not yet set)
  const isExpanded = expanded !== null ? expanded : shouldAutoExpand

  if (isLoading || items.length === 0) return null

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header — clickable */}
      <button
        type="button"
        onClick={() => setExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-500 shrink-0" />
          <span className="text-sm font-semibold text-foreground">
            Próximas Preventivas
          </span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
            {items.length}
          </span>
        </div>
        {isExpanded
          ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground" />
        }
      </button>

      {/* List */}
      {isExpanded && (
        <div className="border-t border-border divide-y divide-border">
          {items.map((item) => {
            const { label, color } = countdownInfo(item.preventive_plan?.next_due_date)
            const freq = formatFrequency(item.preventive_plan)
            const meta = [item.sector?.name, item.supplier?.company_name, freq].filter(Boolean).join(' · ')

            return (
              <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                {/* Blue dot */}
                <div className="mt-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  {meta && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{meta}</p>
                  )}
                </div>

                <span className={cn('text-xs shrink-0 tabular-nums', color)}>
                  {label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
