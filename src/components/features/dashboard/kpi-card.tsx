'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AreaChart, Area } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { SparkPoint } from '@/hooks/use-dashboard'

// ── Trend badge ────────────────────────────────────────────────

function TrendBadge({
  trend,
  invertTrend = false,
}: {
  trend: number | null | undefined
  invertTrend?: boolean
}) {
  if (trend == null) return null

  // Para KPIs onde MENOS é melhor (manutenções, checklists pendentes),
  // inversão semântica: queda = verde, alta = vermelho.
  const isGoodChange = trend > 0 ? !invertTrend : invertTrend

  if (trend > 0) {
    return (
      <span
        title="Comparado com o mês anterior"
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5',
          'text-[11px] font-semibold leading-none',
          isGoodChange
            ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'
            : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
        )}
      >
        <TrendingUp className="w-3 h-3" />
        +{trend}%
      </span>
    )
  }

  if (trend < 0) {
    return (
      <span
        title="Comparado com o mês anterior"
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5',
          'text-[11px] font-semibold leading-none',
          isGoodChange
            ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800'
            : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
        )}
      >
        <TrendingDown className="w-3 h-3" />
        {trend}%
      </span>
    )
  }

  return (
    <span
      title="Comparado com o mês anterior"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5',
        'text-[11px] font-semibold leading-none',
        'bg-muted text-muted-foreground border border-border',
      )}
    >
      <Minus className="w-3 h-3" />
      0%
    </span>
  )
}

// ── Skeleton ───────────────────────────────────────────────────

function KpiCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn(
      'bg-card border border-border rounded-xl p-4 space-y-3',
      className,
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
      {/* Value */}
      <Skeleton className="h-8 w-16" />
      {/* Sparkline */}
      <Skeleton className="h-20 w-full rounded-lg" />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  iconClass: string
  strokeColor: string  // hex color for Recharts
  spark: SparkPoint[]
  trend?: number | null
  /** Inverte a semântica das cores: queda = verde (melhor), alta = vermelho (pior).
   *  Use para KPIs onde menos é desejável (ex: manutenções abertas, checklists pendentes). */
  invertTrend?: boolean
  href: string
  isLoading?: boolean
  className?: string
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  iconClass,
  strokeColor,
  spark,
  trend,
  invertTrend = false,
  href,
  isLoading,
  className,
}: KpiCardProps) {
  const [isInView, setIsInView] = useState(false)
  const [sparkW, setSparkW] = useState(0)

  // Callback ref: fires when the div mounts (even if it mounts after isLoading flips),
  // unlike useRef which only runs the effect once on component mount.
  const sparkRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return

    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width)
      if (w > 0) setSparkW(w)
    })
    ro.observe(el)

    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsInView(true) },
      { threshold: 0.1 },
    )
    io.observe(el)
    // Note: cleanup is not called here because callback refs don't support cleanup.
    // The observers are disconnected when the element is removed from DOM.
  }, [])

  if (isLoading) return <KpiCardSkeleton className={className} />

  // Unique gradient ID per card (avoids SVG conflicts when multiple charts on page)
  const gradId = `kpi-grad-${label.toLowerCase().replace(/\W+/g, '-')}`

  return (
    <Link
      href={href}
      className={cn(
        'group block bg-card border border-border rounded-xl p-4',
        'card-interactive cursor-pointer',
        'hover:border-primary/30',
        className,
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
            iconClass,
          )}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight break-words">
            {label}
          </span>
        </div>
        <TrendBadge trend={trend} invertTrend={invertTrend} />
      </div>

      {/* ── Value ── */}
      <p className="text-3xl font-bold text-foreground leading-none mb-3 tabular-nums">
        {value}
      </p>

      {/* ── Sparkline ── */}
      {/* sparkW gate prevents ResponsiveContainer from rendering with width=-1 */}
      <div ref={sparkRef} className="h-20 -mx-1">
        {spark.length > 0 && sparkW > 0 && (
          <AreaChart
            width={sparkW}
            height={80}
            data={spark}
            margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
          >
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={strokeColor} stopOpacity={0.25} />
                <stop offset="95%" stopColor={strokeColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="v"
              stroke={strokeColor}
              strokeWidth={2}
              fill={`url(#${gradId})`}
              dot={false}
              activeDot={false}
              isAnimationActive={isInView}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </AreaChart>
        )}
      </div>
    </Link>
  )
}
