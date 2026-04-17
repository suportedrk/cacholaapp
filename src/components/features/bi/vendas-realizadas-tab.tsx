'use client'

import { useState } from 'react'
import { ShoppingCart, TrendingUp, Banknote, Receipt, Info, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useBiSalesKpi, useBiSalesRanking } from '@/hooks/use-bi-sales'
import type { BISalesRankingRow } from '@/hooks/use-bi-sales'
import { SellerOrdersDrilldownSheet } from './seller-orders-drilldown-sheet'

// ── Period options ────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: '3M',   value: 3  },
  { label: '6M',   value: 6  },
  { label: '12M',  value: 12 },
  { label: 'Tudo', value: 0  },
] as const

type PeriodValue = typeof PERIOD_OPTIONS[number]['value']

// ── Helpers ───────────────────────────────────────────────────

const DATA_START = '2024-10-01'

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getPeriodDates(months: PeriodValue): { startDate: string; endDate: string } {
  const today   = new Date()
  const endDate = toISODate(today)
  if (months === 0) return { startDate: DATA_START, endDate }
  const start = new Date(today)
  start.setMonth(start.getMonth() - months)
  return { startDate: toISODate(start), endDate }
}

function formatCurrency(v: number | null | undefined): string {
  if (v == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
  }).format(v)
}

function formatCurrencyCompact(v: number | null | undefined): string {
  if (v == null) return '—'
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$${(v / 1_000).toFixed(0)}k`
  return formatCurrency(v)
}

// ── Props ─────────────────────────────────────────────────────

interface Props {
  activeUnitId: string | null
}

// ── Component ─────────────────────────────────────────────────

export function VendasRealizadasTab({ activeUnitId }: Props) {
  const [selectedMonths,   setSelectedMonths]   = useState<PeriodValue>(12)
  const [includeInactive,  setIncludeInactive]  = useState(false)
  const [drillSeller,      setDrillSeller]      = useState<BISalesRankingRow | null>(null)
  const [sheetOpen,        setSheetOpen]        = useState(false)

  const { startDate, endDate } = getPeriodDates(selectedMonths)

  const kpi     = useBiSalesKpi({ startDate, endDate, unitId: activeUnitId, includeInactive })
  const ranking = useBiSalesRanking({ startDate, endDate, unitId: activeUnitId, includeInactive })

  const isLoading = kpi.isLoading || ranking.isLoading
  const isError   = kpi.isError   || ranking.isError

  function openDrill(seller: BISalesRankingRow) {
    setDrillSeller(seller)
    setSheetOpen(true)
  }

  // ── Loading ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="skeleton-shimmer h-24 rounded-xl" />)}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="skeleton-shimmer h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-text-secondary">
        <AlertCircle className="h-8 w-8 text-status-error-text" />
        <p className="text-sm">Erro ao carregar dados de vendas.</p>
        <Button variant="outline" size="sm" onClick={() => { kpi.refetch(); ranking.refetch() }}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    )
  }

  const kpiData  = kpi.data ?? { total_revenue: 0, total_orders: 0, avg_ticket: 0 }
  const rows     = ranking.data ?? []

  return (
    <>
      <div className="space-y-6">

        {/* ── Controls ─────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Period pills */}
          <div className="flex items-center gap-1 bg-surface-secondary rounded-lg p-0.5 border border-border-default">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedMonths(opt.value)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-semibold transition-colors',
                  selectedMonths === opt.value
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Toggle incluir histórico */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setIncludeInactive((v) => !v)}
              className={cn(
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                includeInactive ? 'bg-primary' : 'bg-border-strong'
              )}
            >
              <span
                className={cn(
                  'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                  includeInactive ? 'translate-x-[18px]' : 'translate-x-[3px]'
                )}
              />
            </div>
            <span className="text-xs text-text-secondary">Incluir histórico completo</span>
          </label>
        </div>

        {/* Chip "exibindo inativas" */}
        {includeInactive && (
          <div className="flex items-center gap-1.5 text-xs text-text-secondary">
            <Info className="h-3.5 w-3.5" />
            <span>Exibindo vendedoras inativas</span>
          </div>
        )}

        {/* ── KPI cards ────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border-default bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-text-secondary">
              <Banknote className="h-4 w-4" />
              <span className="text-xs font-medium">Faturamento total</span>
            </div>
            <div className="text-2xl font-bold text-text-primary">
              {formatCurrencyCompact(kpiData.total_revenue)}
            </div>
          </div>
          <div className="rounded-xl border border-border-default bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-text-secondary">
              <ShoppingCart className="h-4 w-4" />
              <span className="text-xs font-medium">Nº de orders</span>
            </div>
            <div className="text-2xl font-bold text-text-primary">
              {kpiData.total_orders.toLocaleString('pt-BR')}
            </div>
          </div>
          <div className="rounded-xl border border-border-default bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-text-secondary">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Ticket médio</span>
            </div>
            <div className="text-2xl font-bold text-text-primary">
              {formatCurrencyCompact(kpiData.avg_ticket)}
            </div>
          </div>
        </div>

        {/* ── Ranking ──────────────────────────────────────── */}
        {rows.length === 0 ? (
          <div className="py-12 text-center text-text-tertiary text-sm">
            Nenhuma vendedora com orders no período.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-border-default">
              <table className="w-full text-sm">
                <thead className="bg-surface-secondary text-text-secondary">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Vendedora</th>
                    <th className="text-right px-4 py-3 font-medium">Receita total</th>
                    <th className="text-right px-4 py-3 font-medium">Nº orders</th>
                    <th className="text-right px-4 py-3 font-medium">Ticket médio</th>
                    <th className="text-right px-4 py-3 font-medium">Méd. mensal</th>
                    <th className="text-center px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {rows.map((row, idx) => (
                    <tr
                      key={row.seller_id}
                      onClick={() => openDrill(row)}
                      className="bg-card hover:bg-surface-secondary transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-text-tertiary w-5 text-right shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-medium text-text-primary">{row.seller_name}</span>
                          {row.is_system_account && (
                            <Badge variant="outline" className="badge-amber border text-xs">sistema</Badge>
                          )}
                          {!row.is_system_account && row.seller_status === 'inactive' && (
                            <Badge variant="outline" className="badge-gray border text-xs">inativa</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-text-primary">
                        {formatCurrency(row.total_revenue)}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">
                        {row.order_count}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">
                        {formatCurrency(row.avg_ticket)}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">
                        {formatCurrency(row.avg_monthly_revenue)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.is_system_account ? (
                          <Badge variant="outline" className="badge-amber border text-xs">sistema</Badge>
                        ) : row.seller_status === 'active' ? (
                          <Badge variant="outline" className="badge-green border text-xs">ativa</Badge>
                        ) : (
                          <Badge variant="outline" className="badge-gray border text-xs">inativa</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card stack */}
            <div className="md:hidden space-y-3">
              {rows.map((row, idx) => (
                <button
                  key={row.seller_id}
                  onClick={() => openDrill(row)}
                  className="w-full text-left rounded-lg border border-border-default bg-card p-4 space-y-3 hover:bg-surface-secondary transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-tertiary">{idx + 1}.</span>
                      <span className="font-medium text-text-primary">{row.seller_name}</span>
                    </div>
                    {row.is_system_account ? (
                      <Badge variant="outline" className="badge-amber border text-xs">sistema</Badge>
                    ) : row.seller_status === 'active' ? (
                      <Badge variant="outline" className="badge-green border text-xs">ativa</Badge>
                    ) : (
                      <Badge variant="outline" className="badge-gray border text-xs">inativa</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-text-tertiary">Receita</div>
                      <div className="font-semibold text-text-primary">{formatCurrency(row.total_revenue)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-tertiary">Orders</div>
                      <div className="font-semibold text-text-primary">{row.order_count}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-tertiary">Ticket médio</div>
                      <div className="text-text-secondary">{formatCurrency(row.avg_ticket)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-text-tertiary">Méd. mensal</div>
                      <div className="text-text-secondary">{formatCurrency(row.avg_monthly_revenue)}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Rodapé — só quando período = Tudo */}
        {selectedMonths === 0 && (
          <p className="text-xs text-text-tertiary text-center pb-2">
            Dados disponíveis a partir de outubro/2024.
          </p>
        )}
      </div>

      {/* Drill-down sheet */}
      <SellerOrdersDrilldownSheet
        seller={drillSeller}
        startDate={startDate}
        endDate={endDate}
        unitId={activeUnitId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  )
}
