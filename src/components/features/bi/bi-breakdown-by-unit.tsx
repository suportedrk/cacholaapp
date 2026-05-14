'use client'

import { BarChart3, Clock, Banknote, TrendingUp } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { InfoPopover } from '@/components/ui/info-popover'
import { UnitChip } from '@/components/shared/unit-chip'
import { useBIConversionData } from '@/hooks/use-bi-conversion'
import { useBISalesMetrics } from '@/hooks/use-bi-sales-metrics'

// ── Types ─────────────────────────────────────────────────────

interface UnitOption { id: string; name: string; slug?: string }

interface Props {
  units: UnitOption[]
  months: number
}

// ── Formatting helpers ─────────────────────────────────────────

function formatCurrency(v: number | null | undefined): string {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v)
}

function formatCurrencyCompact(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(1)}k`
  return formatCurrency(v)
}

// ── Per-unit KPI block ─────────────────────────────────────────

function UnitKpiBlock({ unitId, unitName, unitSlug, months }: { unitId: string; unitName: string; unitSlug?: string; months: number }) {
  // +1 so the hook has the extra month available (same pattern as the main page)
  const conversion   = useBIConversionData(months + 1, unitId)
  const salesMetrics = useBISalesMetrics(months + 1, unitId)

  const isLoading = conversion.isLoading || salesMetrics.isLoading

  // Period aggregates (slice off the extra delta month)
  const convRows  = conversion.data?.rows.slice(1)   ?? []
  const salesRows = salesMetrics.data?.rows.slice(1) ?? []

  const periodTotalLeads = convRows.reduce((s, r) => s + r.total_leads, 0)
  const periodWonLeads   = convRows.reduce((s, r) => s + r.won_leads,   0)
  const periodConvRate   = periodTotalLeads > 0
    ? (periodWonLeads / periodTotalLeads) * 100
    : null

  const periodRevenue  = salesRows.reduce((s, r) => s + r.total_revenue, 0)
  const periodWonDeals = salesRows.reduce((s, r) => s + r.won_deals,     0)
  const periodTicket   = periodWonDeals > 0 ? periodRevenue / periodWonDeals : null
  const periodClosing  = (() => {
    const weight = salesRows.reduce((s, r) => s + r.won_deals, 0)
    if (weight === 0) return null
    const wSum = salesRows.reduce(
      (s, r) => (r.avg_closing_days != null ? s + r.avg_closing_days * r.won_deals : s),
      0,
    )
    return wSum / weight
  })()

  return (
    <div className="rounded-xl border border-border-default bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <UnitChip slug={unitSlug} name={unitName} size="sm" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14 rounded-lg skeleton-shimmer" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-text-tertiary">
              <BarChart3 className="w-3.5 h-3.5" />
              <span className="text-xs">Conversão</span>
            </div>
            <p className="text-lg font-bold text-text-primary">
              {periodConvRate != null ? `${periodConvRate.toFixed(1)}%` : '—'}
            </p>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-text-tertiary">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-xs">Tempo médio</span>
            </div>
            <p className="text-lg font-bold text-text-primary">
              {periodClosing != null ? `${Math.round(periodClosing)} dias` : '—'}
            </p>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-text-tertiary">
              <Banknote className="w-3.5 h-3.5" />
              <span className="text-xs">Ticket médio</span>
            </div>
            <p className="text-lg font-bold text-text-primary">
              {formatCurrency(periodTicket != null && periodTicket > 0 ? periodTicket : null)}
            </p>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-text-tertiary">
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="text-xs">Receita</span>
            </div>
            <p className="text-lg font-bold text-text-primary">
              {formatCurrencyCompact(periodRevenue > 0 ? periodRevenue : null)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────

export function BIBreakdownByUnit({ units, months }: Props) {
  if (units.length <= 1) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
          Detalhe por unidade
        </p>
        <InfoPopover ariaLabel="Informações sobre Detalhe por unidade">
          <div className="space-y-2 text-sm text-text-secondary">
            <p className="font-semibold text-text-primary">Detalhe por unidade</p>
            <p>Quebra os 4 KPIs principais por unidade, usando o mesmo período selecionado acima. Visível apenas quando &quot;Todas as unidades&quot; está selecionado.</p>
            <p>Permite comparar o desempenho de cada unidade de forma rápida: <span className="font-medium text-text-primary">conversão, tempo médio de fechamento, ticket médio e receita total</span>.</p>
          </div>
        </InfoPopover>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {units.map((u) => (
          <UnitKpiBlock key={u.id} unitId={u.id} unitName={u.name} unitSlug={u.slug} months={months} />
        ))}
      </div>
    </div>
  )
}
