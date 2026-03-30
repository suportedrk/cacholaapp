'use client'

import { useEffect, useRef } from 'react'
import { Users, Star, FileWarning, Calendar, MessageSquare } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { ProviderKPIs } from '@/types/providers'

// ─────────────────────────────────────────────────────────────
// Count-up hook
// ─────────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 400, run = true) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!run || !ref.current) return
    const el = ref.current
    const start = performance.now()

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      el.textContent = String(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
  }, [target, duration, run])

  return ref
}

// ─────────────────────────────────────────────────────────────
// Individual KPI card
// ─────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string
  value: number
  icon: React.ReactNode
  iconBg: string
  suffix?: string
  alert?: boolean
  alertPulse?: boolean
}

function KpiCard({ label, value, icon, iconBg, suffix, alert, alertPulse }: KpiCardProps) {
  const ref = useCountUp(value, 400)

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-2 card-interactive">
      {/* Icon */}
      <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
        {icon}
      </span>

      {/* Value */}
      <div className="flex items-baseline gap-0.5">
        <span
          ref={ref}
          className={cn(
            'text-2xl font-semibold tabular-nums',
            alert ? 'text-red-600 dark:text-red-400' : 'text-foreground',
          )}
        >
          {value}
        </span>
        {suffix && (
          <span className={cn('text-sm font-medium ml-0.5', alert ? 'text-red-500' : 'text-amber-500')}>
            {suffix}
          </span>
        )}
      </div>

      {/* Label */}
      <p
        className={cn(
          'text-xs text-muted-foreground leading-tight',
          alertPulse && value > 0 && 'animate-badge-pulse text-amber-600 dark:text-amber-400 font-medium',
        )}
      >
        {label}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────
function KpiCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4 flex flex-col gap-2">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="h-7 w-14" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
interface Props {
  kpis: ProviderKPIs | undefined
  isLoading: boolean
}

export function ProviderKPICards({ kpis, isLoading }: Props) {
  if (isLoading || !kpis) return <KpiCardsSkeleton />

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {/* 1 — Ativos */}
      <KpiCard
        label="Prestadores ativos"
        value={kpis.totalActive}
        icon={<Users className="w-4 h-4" aria-hidden="true" />}
        iconBg="icon-green"
      />

      {/* 2 — Avaliação média */}
      <KpiCard
        label="Avaliação média"
        value={kpis.avgRating}
        suffix="★"
        icon={<Star className="w-4 h-4" aria-hidden="true" />}
        iconBg="icon-amber"
      />

      {/* 3 — Docs vencendo */}
      <KpiCard
        label="Docs vencendo em 30 dias"
        value={kpis.expiringDocsCount}
        icon={<FileWarning className="w-4 h-4" aria-hidden="true" />}
        iconBg={kpis.expiringDocsCount > 0 ? 'icon-red' : 'icon-gray'}
        alert={kpis.expiringDocsCount > 0}
      />

      {/* 4 — Escalados no mês */}
      <KpiCard
        label="Escalados este mês"
        value={kpis.scheduledThisMonth}
        icon={<Calendar className="w-4 h-4" aria-hidden="true" />}
        iconBg="icon-brand"
      />

      {/* 5 — Aguardando avaliação */}
      <KpiCard
        label="Aguardando avaliação"
        value={kpis.pendingRatingsCount}
        icon={<MessageSquare className="w-4 h-4" aria-hidden="true" />}
        iconBg={kpis.pendingRatingsCount > 0 ? 'icon-amber' : 'icon-gray'}
        alertPulse={kpis.pendingRatingsCount > 0}
      />
    </div>
  )
}
