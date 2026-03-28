'use client'

import { useEffect, useRef, useState } from 'react'
import { Wrench, AlertTriangle, CheckCircle2, Clock, Receipt } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useMaintenanceStats } from '@/hooks/use-maintenance-stats'

// ── Counter animation ──────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 500, enabled = true) {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled) return
    if (target === 0) { setValue(0); return }

    const startTime = performance.now()
    const startVal = 0

    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(startVal + eased * target))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration, enabled])

  return value
}

function useCountUpFloat(target: number, duration = 500, enabled = true) {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled) return
    if (target === 0) { setValue(0); return }

    const startTime = performance.now()

    const step = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target * 100) / 100)
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration, enabled])

  return value
}

// ── Format helpers ─────────────────────────────────────────────────────────────

function formatResolution(hours: number | null): string {
  if (hours === null) return '—'
  if (hours < 24) return `${Math.round(hours)}h`
  return `${(hours / 24).toFixed(1)}d`
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value)
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  subText?: React.ReactNode
  variant?: 'default' | 'error' | 'success'
  delay?: number
  interactive?: boolean
}

function KpiCard({ icon, label, value, subText, variant = 'default', delay = 0, interactive = false }: KpiCardProps) {
  const bgClass = {
    default: 'bg-surface-tertiary',
    error: 'bg-status-error-bg',
    success: 'bg-status-success-bg',
  }[variant]

  return (
    <div
      className={cn(
        'rounded-xl p-4 flex flex-col gap-2 animate-fade-slide-up',
        bgClass,
        interactive && 'card-interactive cursor-pointer',
      )}
      style={{
        animationDelay: `${delay}ms`,
        animationFillMode: 'backwards',
      }}
    >
      {/* Icon + label row */}
      <div className="flex items-center gap-2">
        <span className={cn(
          'shrink-0',
          variant === 'error' ? 'text-status-error-text' : 'text-text-secondary',
        )}>
          {icon}
        </span>
        <span className="text-xs font-medium text-text-secondary leading-none">{label}</span>
      </div>

      {/* Value */}
      <div className={cn(
        'text-2xl font-semibold leading-none',
        variant === 'error' ? 'text-status-error-text' : 'text-text-primary',
        variant === 'success' && 'text-status-success-text',
      )}>
        {value}
      </div>

      {/* Sub-text */}
      {subText && (
        <div className="text-xs leading-tight">
          {subText}
        </div>
      )}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function KpiSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="rounded-xl p-4 bg-surface-tertiary animate-fade-slide-up space-y-2"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}
    >
      <div className="flex items-center gap-2">
        <Skeleton className="w-5 h-5 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
      </div>
      <Skeleton className="h-8 w-12 rounded" />
    </div>
  )
}

// ── Individual KPI cards ──────────────────────────────────────────────────────

function OpenCard({ open, emergency, delay }: { open: number; emergency: number; delay: number }) {
  const animated = useCountUp(open)
  return (
    <KpiCard
      delay={delay}
      interactive
      icon={<Wrench className="w-4 h-4" />}
      label="Abertas"
      value={animated}
      subText={
        emergency > 0 ? (
          <span className="flex items-center gap-1 text-status-error-text">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {emergency} emergencial{emergency !== 1 ? 'is' : ''}
          </span>
        ) : undefined
      }
    />
  )
}

function OverdueCard({ count, delay }: { count: number; delay: number }) {
  const animated = useCountUp(count)
  return (
    <KpiCard
      delay={delay}
      interactive
      variant={count > 0 ? 'error' : 'default'}
      icon={<AlertTriangle className="w-4 h-4" />}
      label="Atrasadas"
      value={animated}
    />
  )
}

function CompletedCard({ count, delay }: { count: number; delay: number }) {
  const animated = useCountUp(count)
  return (
    <KpiCard
      delay={delay}
      variant="success"
      icon={<CheckCircle2 className="w-4 h-4" />}
      label="Concluídas (mês)"
      value={animated}
    />
  )
}

function ResolutionCard({ hours, delay }: { hours: number | null; delay: number }) {
  const animated = useCountUpFloat(hours ?? 0, 500, hours !== null)
  const display = hours === null ? '—' : formatResolution(animated)

  return (
    <KpiCard
      delay={delay}
      icon={<Clock className="w-4 h-4" />}
      label="Tempo médio"
      value={display}
    />
  )
}

function CostsCard({ total, pending, delay }: { total: number; pending: number; delay: number }) {
  const animated = useCountUpFloat(total)
  const display = formatCurrency(animated)

  return (
    <KpiCard
      delay={delay}
      interactive
      icon={<Receipt className="w-4 h-4" />}
      label="Custos (mês)"
      value={<span className="text-xl">{display}</span>}
      subText={
        pending > 0 ? (
          <span className="text-status-warning-text">
            {pending} pendente{pending !== 1 ? 's' : ''}
          </span>
        ) : undefined
      }
    />
  )
}

// ── Error state ───────────────────────────────────────────────────────────────

function KpiError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="col-span-2 sm:col-span-3 lg:col-span-5 flex items-center justify-between gap-3 rounded-xl border border-status-error-border bg-status-error-bg px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-status-error-text">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        Erro ao carregar métricas
      </div>
      <button
        onClick={onRetry}
        className="text-xs font-medium text-status-error-text underline underline-offset-2 hover:opacity-80 transition-opacity"
      >
        Tentar novamente
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function MaintenanceKPIs() {
  const { data, isLoading, isError, refetch } = useMaintenanceStats()

  if (isError) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiError onRetry={refetch} />
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <KpiSkeleton key={i} delay={i * 50} />
        ))}
      </div>
    )
  }

  const { kpis } = data

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <OpenCard       open={kpis.open_count}             emergency={kpis.emergency_open}   delay={0}   />
      <OverdueCard    count={kpis.overdue_count}                                            delay={50}  />
      <CompletedCard  count={kpis.completed_this_month}                                     delay={100} />
      <ResolutionCard hours={kpis.avg_resolution_hours}                                     delay={150} />
      {/* On mobile (2-col grid) this 5th card spans both columns */}
      <div className="col-span-2 sm:col-span-1">
        <CostsCard    total={kpis.total_costs_month}     pending={kpis.pending_approvals}  delay={200} />
      </div>
    </div>
  )
}
