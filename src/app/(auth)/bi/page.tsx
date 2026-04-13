'use client'

import { BarChart3, Wrench, AlertCircle, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/features/dashboard/kpi-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useBIConversionData } from '@/hooks/use-bi-conversion'
import { useDashboardKpis } from '@/hooks/use-dashboard'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { CHART_COLORS } from '@/lib/constants/brand-colors'

// ── Month formatting ──────────────────────────────────────────

function formatMonth(yyyyMM: string): string {
  const [year, month] = yyyyMM.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// ── Loading skeleton ──────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="rounded-xl border border-border-default bg-card p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <Skeleton className="w-8 h-8 rounded-lg skeleton-shimmer" />
        <Skeleton className="h-3 w-28 skeleton-shimmer" />
      </div>
      <Skeleton className="h-8 w-20 skeleton-shimmer" />
      <Skeleton className="h-16 w-full skeleton-shimmer" />
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────

export default function BIPage() {
  const conversion = useBIConversionData(7)
  const kpis = useDashboardKpis()

  const isLoading = conversion.isLoading || kpis.isLoading
  const isError   = conversion.isError   || kpis.isError
  const isTimeout = useLoadingTimeout(isLoading)

  const currentMonth = getCurrentMonth()

  // ── Derived conversion values ─────────────────────────────
  const convValue = conversion.data?.currentRate != null
    ? `${conversion.data.currentRate.toFixed(1)}%`
    : '—'

  const maintenance = kpis.data?.maintenance

  // ── Error / timeout state ─────────────────────────────────
  if ((isError || isTimeout) && !conversion.data && !kpis.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Business Intelligence"
          description="Análise de conversão e operações"
        />
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
          <div className="w-12 h-12 rounded-full bg-status-error-bg flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-status-error-text" />
          </div>
          <p className="text-text-secondary text-sm max-w-xs">
            Não foi possível carregar os dados. Verifique sua conexão.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              conversion.refetch()
              kpis.refetch()
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  // ── Table rows (newest first for display) ─────────────────
  const tableRows = conversion.data
    ? [...conversion.data.rows].reverse().slice(0, 6)
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Intelligence"
        description="Análise de conversão e operações"
      />

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isLoading ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            {/* Conversão */}
            <KpiCard
              label="Taxa de Conversão"
              value={convValue}
              icon={BarChart3}
              iconClass="icon-brand"
              strokeColor={CHART_COLORS.primary}
              spark={conversion.data?.spark ?? []}
              trend={conversion.data?.trend ?? null}
              href="/bi"
            />

            {/* Manutenções Abertas */}
            <KpiCard
              label="Manutenções Abertas"
              value={maintenance?.value ?? 0}
              icon={Wrench}
              iconClass="icon-warning"
              strokeColor={CHART_COLORS.maintenancePending}
              spark={maintenance?.spark ?? []}
              trend={maintenance?.trend ?? null}
              invertTrend
              href="/manutencao"
            />
          </>
        )}
      </div>

      {/* ── Monthly Conversion Table ── */}
      <div className="rounded-xl border border-border-default bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary">
            Conversão por Mês
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Baseado na data de criação do lead no Ploomes
          </p>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <Skeleton className="h-4 w-20 skeleton-shimmer" />
                <Skeleton className="h-4 w-12 skeleton-shimmer" />
                <Skeleton className="h-4 w-10 skeleton-shimmer" />
                <Skeleton className="h-4 w-14 skeleton-shimmer" />
              </div>
            ))}
          </div>
        ) : tableRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
            <BarChart3 className="w-8 h-8 text-text-tertiary" />
            <p className="text-sm text-text-secondary">
              Nenhum dado disponível no período.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="border-b border-border-default bg-surface-secondary">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wide">
                    Mês
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wide">
                    Leads
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wide">
                    Ganhos
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wide">
                    Conversão
                  </th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => {
                  const isCurrent = row.month === currentMonth
                  return (
                    <tr
                      key={row.month}
                      className={cn(
                        'border-b border-border-default last:border-0 transition-colors',
                        isCurrent
                          ? 'bg-brand-50 dark:bg-brand-900/20'
                          : 'hover:bg-surface-secondary',
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-text-primary tabular-nums">
                        <span className="flex items-center gap-2">
                          {formatMonth(row.month)}
                          {isCurrent && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-800/40 dark:text-brand-300 border border-brand-200 dark:border-brand-700">
                              atual
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary tabular-nums">
                        {row.total_leads.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary tabular-nums">
                        {row.won_leads.toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">
                        {row.conversion_rate != null ? (
                          <span
                            className={cn(
                              row.conversion_rate >= 10
                                ? 'text-green-600 dark:text-green-400'
                                : row.conversion_rate >= 5
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-red-600 dark:text-red-400',
                            )}
                          >
                            {row.conversion_rate.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
