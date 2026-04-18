'use client'

import { TrendingUp, TrendingDown, Minus, DollarSign, ShoppingBag, Trophy, Tag, Percent } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { VendasMyKpis } from '@/hooks/use-vendas'

// ── Helpers ───────────────────────────────────────────────────

function formatCurrency(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
  }).format(v)
}

function formatPercent(v: number): string {
  return `${v.toFixed(1)}%`
}

function delta(curr: number, prev: number): { pct: number; positive: boolean; neutral: boolean } {
  if (prev === 0) return { pct: 0, positive: curr > 0, neutral: curr === 0 }
  const pct = ((curr - prev) / prev) * 100
  return { pct, positive: pct >= 0, neutral: Math.abs(pct) < 0.05 }
}

// ── Delta badge ───────────────────────────────────────────────

function DeltaBadge({ curr, prev }: { curr: number; prev: number }) {
  const { pct, positive, neutral } = delta(curr, prev)
  if (neutral) return (
    <span className="inline-flex items-center gap-0.5 text-xs text-text-tertiary">
      <Minus className="w-3 h-3" />
      0%
    </span>
  )
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-xs font-medium',
      positive ? 'text-status-success-text' : 'text-status-error-text',
    )}>
      {positive
        ? <TrendingUp className="w-3 h-3" />
        : <TrendingDown className="w-3 h-3" />
      }
      {positive ? '+' : ''}{pct.toFixed(1)}%
    </span>
  )
}

// ── Card ──────────────────────────────────────────────────────

interface CardProps {
  icon:     React.ReactNode
  label:    string
  value:    string
  curr:     number
  prev:     number
}

function KpiCard({ icon, label, value, curr, prev }: CardProps) {
  return (
    <div className="bg-card rounded-xl border border-border-default p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary font-medium">{label}</span>
        <span className="icon-brand rounded-md p-1.5">{icon}</span>
      </div>
      <div className="text-2xl font-bold text-text-primary tracking-tight">{value}</div>
      <DeltaBadge curr={curr} prev={prev} />
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────

function KpiCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border-default p-4 space-y-2">
      <div className="flex justify-between">
        <Skeleton className="skeleton-shimmer h-3 w-24 rounded" />
        <Skeleton className="skeleton-shimmer h-7 w-7 rounded-md" />
      </div>
      <Skeleton className="skeleton-shimmer h-8 w-32 rounded" />
      <Skeleton className="skeleton-shimmer h-3 w-12 rounded" />
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────

interface Props {
  kpis:      VendasMyKpis | undefined
  isLoading: boolean
}

export function KpiCards({ kpis, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => <KpiCardSkeleton key={i} />)}
      </div>
    )
  }

  const k = kpis ?? {
    total_revenue: 0, order_count: 0, avg_ticket: 0,
    won_count: 0, conversion_rate: 0,
    prev_revenue: 0, prev_order_count: 0, prev_avg_ticket: 0,
    prev_won_count: 0, prev_conversion_rate: 0,
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <KpiCard
        icon={<DollarSign className="w-4 h-4" />}
        label="Faturamento"
        value={formatCurrency(k.total_revenue)}
        curr={k.total_revenue}
        prev={k.prev_revenue}
      />
      <KpiCard
        icon={<Trophy className="w-4 h-4" />}
        label="Deals ganhos"
        value={String(k.won_count)}
        curr={k.won_count}
        prev={k.prev_won_count}
      />
      <KpiCard
        icon={<ShoppingBag className="w-4 h-4" />}
        label="Orders"
        value={String(k.order_count)}
        curr={k.order_count}
        prev={k.prev_order_count}
      />
      <KpiCard
        icon={<Tag className="w-4 h-4" />}
        label="Ticket médio"
        value={formatCurrency(k.avg_ticket)}
        curr={k.avg_ticket}
        prev={k.prev_avg_ticket}
      />
      <KpiCard
        icon={<Percent className="w-4 h-4" />}
        label="Conversão"
        value={formatPercent(k.conversion_rate)}
        curr={k.conversion_rate}
        prev={k.prev_conversion_rate}
      />
    </div>
  )
}
