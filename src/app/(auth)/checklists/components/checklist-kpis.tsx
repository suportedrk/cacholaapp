'use client'

import { useEffect, useRef } from 'react'
import {
  BarChart, Bar, Cell, Tooltip,
} from 'recharts'
import {
  ClipboardList, Clock, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChecklistStats } from '@/hooks/use-checklist-stats'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { BRAND_GREEN } from '@/lib/constants/brand-colors'
import type { Priority } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// PRIORITY → labels PT-BR (Recharts tooltip)
// ─────────────────────────────────────────────────────────────
const PRIORITY_LABELS_PT: Record<string, string> = {
  urgent: 'Urgente',
  high:   'Alta',
  medium: 'Média',
  low:    'Baixa',
}

// ─────────────────────────────────────────────────────────────
// PRIORITY → cor Hex (Recharts)
// ─────────────────────────────────────────────────────────────
const PRIORITY_HEX: Record<Priority, string> = {
  low:    '#22C55E',
  medium: BRAND_GREEN[500],
  high:   '#F59E0B',
  urgent: '#EF4444',
}

// ─────────────────────────────────────────────────────────────
// countUp hook
// ─────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 500) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (ref.current === null) return
    const el = ref.current
    const start = performance.now()
    const startVal = 0

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      el.textContent = String(target)
      return
    }

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      el.textContent = String(Math.round(startVal + eased * (target - startVal)))
      if (progress < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  }, [target, duration])

  return ref
}

// ─────────────────────────────────────────────────────────────
// KPI CARD
// ─────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string
  value: number
  subText?: string
  icon: React.ReactNode
  iconClass?: string
  variant?: 'default' | 'error' | 'success'
  sparkData?: { name: string; value: number; color?: string }[]
  delay?: number
}

function KpiCard({
  label,
  value,
  subText,
  icon,
  iconClass = 'icon-brand',
  variant = 'default',
  sparkData,
  delay = 0,
}: KpiCardProps) {
  const countRef = useCountUp(value)

  return (
    <div
      className={cn(
        'bg-card border rounded-xl p-4 space-y-2 animate-fade-up',
        variant === 'error' && value > 0
          ? 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20'
          : variant === 'success'
          ? 'border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20'
          : 'border-border',
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className={cn('p-1.5 rounded-lg', iconClass)}>{icon}</div>
        {sparkData && sparkData.length > 0 && (
          <BarChart
            width={80}
            height={28}
            data={sparkData}
            margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
          >
            <Bar dataKey="value" radius={[2, 2, 0, 0]}>
              {sparkData.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.color ?? BRAND_GREEN[500]}
                  fillOpacity={0.8}
                />
              ))}
            </Bar>
            <Tooltip
              contentStyle={{ fontSize: 11, padding: '2px 6px' }}
              itemStyle={{ color: '#374151' }}
              cursor={{ fill: 'rgba(0,0,0,0.05)' }}
              formatter={(value, name) => [value, PRIORITY_LABELS_PT[String(name)] ?? String(name)]}
            />
          </BarChart>
        )}
      </div>

      {/* Value */}
      <div>
        <p
          className={cn(
            'text-3xl font-bold tabular-nums',
            variant === 'error' && value > 0
              ? 'text-red-600 dark:text-red-400'
              : variant === 'success'
              ? 'text-green-600 dark:text-green-400'
              : 'text-foreground',
          )}
        >
          <span ref={countRef}>0</span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{label}</p>
      </div>

      {/* Sub-text */}
      {subText && (
        <p className="text-xs text-muted-foreground border-t border-border pt-2">{subText}</p>
      )}
    </div>
  )
}

function KpiCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-2 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="w-8 h-8 rounded-lg bg-muted" />
        {/* espaço reservado sem tarja visível */}
        <div className="w-20 h-7" />
      </div>
      <div>
        <div className="h-8 w-14 rounded bg-muted" />
        <div className="h-3 w-24 rounded bg-muted mt-1" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// CHECKLIST KPIs
// ─────────────────────────────────────────────────────────────
export function ChecklistKPIs() {
  const { data: stats, isLoading } = useChecklistStats()
  const { isTimedOut } = useLoadingTimeout(isLoading)

  if (isLoading && !isTimedOut) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
      </div>
    )
  }

  if (!stats) return null

  // Spark data: distribuição por prioridade (4 pontos)
  const prioritySpark = stats.byPriority.map((p) => ({
    name: p.priority,
    value: p.count,
    color: PRIORITY_HEX[p.priority],
  }))

  // Texto do tempo médio de conclusão
  const avgText = stats.avgCompletionHours !== null
    ? stats.avgCompletionHours < 1
      ? `Tempo médio: ${Math.round(stats.avgCompletionHours * 60)}min`
      : stats.avgCompletionHours < 24
      ? `Tempo médio: ${stats.avgCompletionHours}h`
      : `Tempo médio: ${Math.round(stats.avgCompletionHours / 24)} dias`
    : undefined

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Total */}
      <KpiCard
        label="Total de checklists"
        value={stats.total}
        icon={<ClipboardList className="w-4 h-4" />}
        iconClass="icon-brand"
        sparkData={prioritySpark.length ? prioritySpark : undefined}
        subText={
          stats.byCategory.length > 0
            ? `${stats.byCategory.length} categoria${stats.byCategory.length !== 1 ? 's' : ''}`
            : undefined
        }
        delay={0}
      />

      {/* Pendentes */}
      <KpiCard
        label="Pendentes e em andamento"
        value={stats.pending + stats.in_progress}
        icon={<Clock className="w-4 h-4" />}
        iconClass="icon-amber"
        subText={
          stats.in_progress > 0
            ? `${stats.in_progress} em andamento`
            : undefined
        }
        delay={50}
      />

      {/* Atrasados */}
      <KpiCard
        label="Atrasados"
        value={stats.overdue}
        icon={<AlertTriangle className="w-4 h-4" />}
        iconClass={stats.overdue > 0 ? 'icon-red' : 'icon-gray'}
        variant={stats.overdue > 0 ? 'error' : 'default'}
        subText={
          stats.overdue > 0
            ? `${stats.completedToday > 0 ? `${stats.completedToday} concluídos hoje` : 'Nenhum concluído hoje'}`
            : 'Tudo em dia!'
        }
        delay={100}
      />

      {/* Concluídos esta semana */}
      <KpiCard
        label="Concluídos esta semana"
        value={stats.completedThisWeek}
        icon={<CheckCircle2 className="w-4 h-4" />}
        iconClass={stats.completedThisWeek > 0 ? 'icon-green' : 'icon-gray'}
        variant={stats.completedThisWeek > 0 ? 'success' : 'default'}
        subText={avgText}
        delay={150}
      />
    </div>
  )
}
