'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { useMaintenanceStats } from '@/hooks/use-maintenance-stats'
import { BRAND_GREEN } from '@/lib/constants/brand-colors'

// ── Type colors (hex — Recharts/CSS need literal values) ──────────────────────
const TYPE_COLORS: Record<string, string> = {
  Emergencial: '#EF4444',
  Pontual:     '#F59E0B',
  Recorrente:  '#22C55E',
  Preventiva:  '#3B82F6',
}

const SECTOR_COLOR = BRAND_GREEN[500] // #7C8D78

// ── Animated bar ──────────────────────────────────────────────────────────────

interface AnimatedBarProps {
  label: string
  count: number
  maxCount: number
  color: string
  delay?: number
}

function AnimatedBar({ label, count, maxCount, color, delay = 0 }: AnimatedBarProps) {
  const [width, setWidth] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const pct = maxCount === 0 ? 2 : Math.max((count / maxCount) * 100, count === 0 ? 0 : 3)
    const timeout = setTimeout(() => setWidth(pct), 60 + delay)
    return () => clearTimeout(timeout)
  }, [count, maxCount, delay])

  return (
    <div className="flex items-center gap-2 group">
      {/* Label */}
      <span className="w-28 shrink-0 text-xs text-text-secondary truncate" title={label}>
        {label}
      </span>

      {/* Bar track */}
      <div className="flex-1 h-5 rounded bg-surface-tertiary dark:bg-surface-tertiary overflow-hidden">
        <div
          ref={ref}
          className="h-full rounded transition-all duration-500 ease-out"
          style={{
            width: `${width}%`,
            backgroundColor: color,
            opacity: 0.85,
          }}
        />
      </div>

      {/* Count */}
      <span className="w-5 shrink-0 text-right text-xs font-medium text-text-primary tabular-nums">
        {count}
      </span>
    </div>
  )
}

// ── Recharts custom tooltip ───────────────────────────────────────────────────

function WeeklyTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-surface-secondary px-3 py-2 shadow-sm text-xs">
      <p className="text-text-secondary">Semana de {label}</p>
      <p className="font-semibold text-text-primary mt-0.5">
        {payload[0].value} concluída{payload[0].value !== 1 ? 's' : ''}
      </p>
    </div>
  )
}

// ── Area Chart Card ───────────────────────────────────────────────────────────

function WeeklyChart({ data, delay }: {
  data: Array<{ week: string; count: number }>
  delay: number
}) {
  const total = data.reduce((s, d) => s + d.count, 0)
  const allZero = total === 0

  return (
    <div
      className="rounded-xl border border-border bg-surface-secondary p-4 space-y-3 animate-fade-slide-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}
    >
      {/* Header */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-text-primary">Concluídas por semana</span>
        <span className="text-xs text-text-secondary tabular-nums">
          {total} total
        </span>
      </div>

      {allZero ? (
        <div className="flex h-[140px] items-center justify-center text-xs text-text-tertiary text-center px-4">
          Nenhuma ordem concluída nas últimas 4 semanas
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -32, bottom: 0 }}>
            <defs>
              <linearGradient id="maint-weekly-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#22C55E" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#22C55E" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: 'var(--color-text-secondary, #71717A)' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<WeeklyTooltip />} cursor={{ stroke: 'var(--color-border-default, #E4E4E7)', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#22C55E"
              strokeWidth={2}
              fill="url(#maint-weekly-grad)"
              dot={{ fill: '#22C55E', r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
              animationDuration={700}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Distribution Chart Card ───────────────────────────────────────────────────

function DistributionChart({ byType, bySector, delay }: {
  byType:   Array<{ type: string; count: number }>
  bySector: Array<{ sector: string; count: number }>
  delay: number
}) {
  const maxType   = Math.max(...byType.map((d) => d.count), 1)
  const maxSector = Math.max(...bySector.map((d) => d.count), 1)

  return (
    <div
      className="rounded-xl border border-border bg-surface-secondary p-4 space-y-3 animate-fade-slide-up"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}
    >
      {/* Header */}
      <span className="text-sm font-medium text-text-primary">Distribuição</span>

      {/* By type */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
          Por tipo
        </p>
        {byType.map((item, i) => (
          <AnimatedBar
            key={item.type}
            label={item.type}
            count={item.count}
            maxCount={maxType}
            color={TYPE_COLORS[item.type] ?? '#A1A1AA'}
            delay={i * 60}
          />
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-border" />

      {/* By sector */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
          Por setor
        </p>
        {bySector.length === 0 ? (
          <p className="text-xs text-text-tertiary py-1">Sem dados de setor</p>
        ) : (
          bySector.map((item, i) => (
            <AnimatedBar
              key={item.sector}
              label={item.sector}
              count={item.count}
              maxCount={maxSector}
              color={SECTOR_COLOR}
              delay={i * 60}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Weekly skeleton */}
      <div className="rounded-xl border border-border bg-surface-secondary p-4 space-y-3">
        <div className="flex items-baseline justify-between">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-12" />
        </div>
        <Skeleton className="h-[140px] w-full rounded-lg skeleton-shimmer" />
      </div>

      {/* Distribution skeleton */}
      <div className="rounded-xl border border-border bg-surface-secondary p-4 space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-16" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 flex-1 rounded" />
            <Skeleton className="h-3 w-4" />
          </div>
        ))}
        <div className="border-t border-border pt-2 space-y-2">
          <Skeleton className="h-3 w-16" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 flex-1 rounded" />
              <Skeleton className="h-3 w-4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Error state ───────────────────────────────────────────────────────────────

function ChartsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-xl border border-status-error-border bg-status-error-bg px-4 py-3">
        <div className="flex items-center gap-2 text-sm text-status-error-text">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Erro ao carregar gráficos
        </div>
        <button
          onClick={onRetry}
          className="text-xs font-medium text-status-error-text underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function MaintenanceCharts() {
  const { data, isLoading, isError, refetch } = useMaintenanceStats()

  if (isError) return <ChartsError onRetry={refetch} />
  if (isLoading || !data) return <ChartsSkeleton />

  const { charts } = data

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <WeeklyChart       data={charts.weekly_completed}                          delay={0}  />
      <DistributionChart byType={charts.by_type} bySector={charts.by_sector}    delay={50} />
    </div>
  )
}
