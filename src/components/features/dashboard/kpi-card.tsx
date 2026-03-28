'use client'

import { useRef, useEffect, useState } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { SparkPoint } from '@/hooks/use-dashboard'

// ── Trend badge ────────────────────────────────────────────────

function TrendBadge({ trend }: { trend: number | null | undefined }) {
  if (trend == null) return null

  if (trend > 0) {
    return (
      <span
        title="Comparado com o mês anterior"
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5',
          'text-[11px] font-semibold leading-none',
          'bg-green-50 text-green-700 border border-green-200',
          'dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
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
          'bg-red-50 text-red-700 border border-red-200',
          'dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
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
  href,
  isLoading,
  className,
}: KpiCardProps) {
  const sparkRef  = useRef<HTMLDivElement>(null)
  const [isInView, setIsInView] = useState(false)

  // Animate sparkline when card enters viewport
  useEffect(() => {
    const el = sparkRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsInView(true) },
      { threshold: 0.1 },
    )
    obs.observe(el)
    return () => obs.disconnect()
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
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider leading-none truncate">
            {label}
          </span>
        </div>
        <TrendBadge trend={trend} />
      </div>

      {/* ── Value ── */}
      <p className="text-3xl font-bold text-foreground leading-none mb-3 tabular-nums">
        {value}
      </p>

      {/* ── Sparkline ── */}
      <div ref={sparkRef} className="h-20 -mx-1">
        {spark.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
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
          </ResponsiveContainer>
        )}
      </div>
    </Link>
  )
}
