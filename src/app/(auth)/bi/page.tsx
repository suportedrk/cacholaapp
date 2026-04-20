'use client'

import {
  BarChart3,
  Clock,
  Banknote,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  CalendarClock,
  Wrench,
  ArrowRight,
  Filter,
  Building2,
  Download,
  Loader2,
  Users2,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/features/dashboard/kpi-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useBIConversionData } from '@/hooks/use-bi-conversion'
import { useBISalesMetrics } from '@/hooks/use-bi-sales-metrics'
import { useBIFunnelData } from '@/hooks/use-bi-funnel'
import { useBIUnitComparison } from '@/hooks/use-bi-unit-comparison'
import { useDashboardKpis } from '@/hooks/use-dashboard'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { useUnitStore } from '@/stores/unit-store'
import { useAuth } from '@/hooks/use-auth'
import { CHART_COLORS } from '@/lib/constants/brand-colors'
import { BIFunnel } from '@/components/features/bi/bi-funnel'
import { BIUnitComparison } from '@/components/features/bi/bi-unit-comparison'
import { BITrendCharts } from '@/components/features/bi/bi-trend-charts'
import { SellersTab } from '@/components/features/bi/sellers-tab'
import { VendasRealizadasTab } from '@/components/features/bi/vendas-realizadas-tab'
import { exportBIReport } from '@/lib/bi/export-bi-report'
import { BI_ATENDIMENTO_ROLES, BI_VENDAS_ROLES, hasRole } from '@/config/roles'

// ── Formatting helpers ────────────────────────────────────────

function formatMonth(yyyyMM: string): string {
  const [year, month] = yyyyMM.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCurrencyCompact(value: number | null | undefined): string {
  if (value == null) return '—'
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000)     return `R$ ${(value / 1_000).toFixed(1)}k`
  return formatCurrency(value)
}

// ── Loading skeleton ──────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="rounded-xl border border-border-default bg-card p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <Skeleton className="w-8 h-8 rounded-lg skeleton-shimmer" />
        <Skeleton className="h-3 w-28 skeleton-shimmer" />
      </div>
      <Skeleton className="h-8 w-24 skeleton-shimmer" />
      <Skeleton className="h-16 w-full skeleton-shimmer" />
    </div>
  )
}

// ── Period options ────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: '3M',   value: 3  },
  { label: '6M',   value: 6  },
  { label: '12M',  value: 12 },
  { label: 'Tudo', value: 24 },
] as const

type PeriodValue = typeof PERIOD_OPTIONS[number]['value']

// ── Main Page ─────────────────────────────────────────────────

export default function BIPage() {
  const [selectedMonths, setSelectedMonths] = useState<PeriodValue>(6)
  const [selectedTab, setSelectedTab]       = useState('visao-geral')

  // +1 so we always have the previous month available for trend calculation
  const conversion     = useBIConversionData(selectedMonths + 1)
  const salesMetrics   = useBISalesMetrics(selectedMonths + 1)
  const funnel         = useBIFunnelData()
  const unitComparison = useBIUnitComparison(selectedMonths)
  const { activeUnit } = useUnitStore()
  const [isExporting, setIsExporting] = useState(false)
  const kpis           = useDashboardKpis()

  const { profile, userUnits } = useAuth()
  const canSeeSellers = hasRole(profile?.role, BI_ATENDIMENTO_ROLES)
  const canSeeVendas  = hasRole(profile?.role, BI_VENDAS_ROLES)
  const units = userUnits.map((u) => ({ id: u.unit.id, name: u.unit.name }))

  const isLoading = conversion.isLoading || salesMetrics.isLoading || kpis.isLoading
  const isError   = conversion.isError   || salesMetrics.isError
  const { isTimedOut: isTimeout } = useLoadingTimeout(isLoading)

  const currentMonth = getCurrentMonth()

  // ── Derived values ────────────────────────────────────────
  const convValue = conversion.data?.currentRate != null
    ? `${conversion.data.currentRate.toFixed(1)}%`
    : '—'

  const closingValue = salesMetrics.data?.currentMonth?.avg_closing_days != null
    ? `${Math.round(salesMetrics.data.currentMonth.avg_closing_days)} dias`
    : '—'

  const ticketValue = salesMetrics.data?.currentMonth?.avg_ticket != null
    ? formatCurrency(salesMetrics.data.currentMonth.avg_ticket)
    : '—'

  const revenueValue = salesMetrics.data?.currentMonth?.total_revenue != null
    ? formatCurrencyCompact(salesMetrics.data.currentMonth.total_revenue)
    : '—'

  const maintenance = kpis.data?.maintenance

  // ── Export handler ────────────────────────────────────────
  async function handleExport() {
    if (!conversion.data || !salesMetrics.data) return
    setIsExporting(true)
    try {
      await exportBIReport({
        conversion:     conversion.data,
        sales:          salesMetrics.data,
        funnel:         funnel.data ?? { stages: [], totalDeals: 0 },
        unitComparison: unitComparison.data ?? [],
        unitName:       activeUnit?.name ?? 'Todas as unidades',
        exportDate:     new Date(),
      })
    } finally {
      setIsExporting(false)
    }
  }

  // ── Error / timeout state ─────────────────────────────────
  if ((isError || isTimeout) && !conversion.data && !salesMetrics.data) {
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
              salesMetrics.refetch()
              funnel.refetch()
              unitComparison.refetch()
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

  // ── Build merged table rows (newest first) ────────────────
  type MergedRow = {
    month: string
    total_leads: number
    won_leads: number
    conversion_rate: number | null
    total_revenue: number
    avg_ticket: number | null
    avg_closing_days: number | null
    avg_booking_advance_days: number | null
  }

  const conversionMap = new Map(
    (conversion.data?.rows ?? []).map((r) => [r.month, r]),
  )
  const salesMap = new Map(
    (salesMetrics.data?.rows ?? []).map((r) => [r.month, r]),
  )

  // Union of months from both sources, sorted newest first
  const allMonths = Array.from(
    new Set([...conversionMap.keys(), ...salesMap.keys()]),
  ).sort((a, b) => b.localeCompare(a)).slice(0, selectedMonths)

  const tableRows: MergedRow[] = allMonths.map((month) => {
    const c = conversionMap.get(month)
    const s = salesMap.get(month)
    return {
      month,
      total_leads:              c?.total_leads             ?? 0,
      won_leads:                c?.won_leads               ?? 0,
      conversion_rate:          c?.conversion_rate         ?? null,
      total_revenue:            s?.total_revenue           ?? 0,
      avg_ticket:               s?.avg_ticket              ?? null,
      avg_closing_days:         s?.avg_closing_days        ?? null,
      avg_booking_advance_days: s?.avg_booking_advance_days ?? null,
    }
  })

  // ── Antecedência info ─────────────────────────────────────
  const advanceCurrent  = salesMetrics.data?.currentMonth?.avg_booking_advance_days
  const advancePrevious = salesMetrics.data?.previousMonth?.avg_booking_advance_days

  const canExport = !!conversion.data && !!salesMetrics.data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business Intelligence"
        description="Análise de conversão e operações"
      />

      {/* ── Tab navigation ── */}
      <Tabs
        value={selectedTab}
        onValueChange={setSelectedTab}
        className="gap-0"
      >
        {(canSeeSellers || canSeeVendas) && (
          <TabsList variant="line" className="mb-0">
            <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
            {canSeeSellers && (
              <TabsTrigger value="vendedoras" className="gap-1.5">
                <Users2 className="w-4 h-4" />
                Atendimento (Deals)
              </TabsTrigger>
            )}
            {canSeeVendas && (
              <TabsTrigger value="vendas-realizadas" className="gap-1.5">
                <Users2 className="w-4 h-4" />
                Vendas Realizadas (Orders)
              </TabsTrigger>
            )}
          </TabsList>
        )}

        {/* ── Visão Geral ── */}
        <TabsContent value="visao-geral" className={cn('space-y-6', canSeeSellers ? 'mt-6' : 'mt-0')}>

          {/* Period pills + Export */}
          <div className="flex items-center gap-2 flex-wrap justify-between">
            <div className="flex items-center gap-1 bg-surface-secondary rounded-lg p-0.5 border border-border-default">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedMonths(opt.value)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-semibold transition-colors',
                    selectedMonths === opt.value
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-tertiary',
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={!canExport || isExporting}
              className="gap-1.5"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isExporting ? 'Gerando…' : 'Exportar Excel'}
            </Button>
          </div>

          {/* ── 4 KPI Cards — 2×2 grid ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isLoading ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            {/* 1. Taxa de Conversão */}
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

            {/* 2. Tempo Médio de Fechamento */}
            <KpiCard
              label="Tempo Médio de Fechamento"
              value={closingValue}
              icon={Clock}
              iconClass="icon-blue"
              strokeColor="#6B9E8B"
              spark={salesMetrics.data?.sparkClosing ?? []}
              trend={salesMetrics.data?.trendClosing ?? null}
              invertTrend
              href="/bi"
            />

            {/* 3. Ticket Médio */}
            <KpiCard
              label="Ticket Médio"
              value={ticketValue}
              icon={Banknote}
              iconClass="icon-green"
              strokeColor={CHART_COLORS.eventConfirmed}
              spark={salesMetrics.data?.sparkTicket ?? []}
              trend={salesMetrics.data?.trendTicket ?? null}
              href="/bi"
            />

            {/* 4. Receita do Mês */}
            <KpiCard
              label="Receita do Mês"
              value={revenueValue}
              icon={TrendingUp}
              iconClass="icon-amber"
              strokeColor="#D4A858"
              spark={salesMetrics.data?.sparkRevenue ?? []}
              trend={salesMetrics.data?.trendRevenue ?? null}
              href="/bi"
            />
          </>
        )}
      </div>

      {/* ── Insight: Antecedência de Reserva ── */}
      {!isLoading && (
        <div className="rounded-xl border border-border-default bg-surface-secondary px-4 py-3 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg icon-brand flex items-center justify-center shrink-0 mt-0.5">
            <CalendarClock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary">
              Antecedência Média de Reserva
            </p>
            {advanceCurrent != null ? (
              <p className="text-sm text-text-secondary mt-0.5">
                Clientes fecham em média{' '}
                <span className="font-semibold text-text-primary">
                  {Math.round(advanceCurrent)} dias
                </span>{' '}
                antes da festa.
                {advancePrevious != null && (
                  <span className="text-text-tertiary">
                    {' '}Mês passado: {Math.round(advancePrevious)} dias.
                  </span>
                )}
              </p>
            ) : (
              <p className="text-sm text-text-secondary mt-0.5">
                Dados insuficientes no período selecionado.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Manutenções abertas — linha compacta ── */}
      {!isLoading && maintenance != null && maintenance.value > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/10 px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <Wrench className="w-4 h-4 shrink-0" />
            <span>
              <span className="font-semibold">{maintenance.value}</span>
              {' '}manutenç{maintenance.value === 1 ? 'ão aberta' : 'ões abertas'}
            </span>
          </div>
          <Link
            href="/manutencao"
            className="flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline shrink-0"
          >
            Ver chamados
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* ── Gráficos de Tendência ── */}
      <BITrendCharts
        conversionRows={conversion.data?.rows ?? []}
        salesRows={salesMetrics.data?.rows ?? []}
        isLoading={isLoading}
      />

      {/* ── Funil do Pipeline ── */}
      <div className="rounded-xl border border-border-default bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border-default flex items-center gap-2">
          <Filter className="w-4 h-4 text-text-tertiary" />
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Funil do Pipeline</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Distribuição acumulada de todos os deals por stage
            </p>
          </div>
        </div>
        <div className="p-4">
          {funnel.isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-40 skeleton-shimmer" />
                    <Skeleton className="h-3 w-8 skeleton-shimmer" />
                  </div>
                  <Skeleton className="h-5 w-full skeleton-shimmer" />
                </div>
              ))}
            </div>
          ) : funnel.isError ? (
            <p className="text-sm text-text-secondary py-4 text-center">
              Não foi possível carregar o funil.
            </p>
          ) : (funnel.data?.stages.length ?? 0) === 0 ? (
            <p className="text-sm text-text-secondary py-4 text-center">
              Nenhum deal encontrado.
            </p>
          ) : (
            <BIFunnel
              stages={funnel.data!.stages}
              totalDeals={funnel.data!.totalDeals}
            />
          )}
        </div>
      </div>

      {/* ── Comparativo entre Unidades ── */}
      <div className="rounded-xl border border-border-default bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border-default flex items-center gap-2">
          <Building2 className="w-4 h-4 text-text-tertiary" />
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Comparativo entre Unidades</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Métricas dos últimos {selectedMonths} meses por unidade
            </p>
          </div>
        </div>
        {unitComparison.isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-40 skeleton-shimmer" />
                <Skeleton className="h-4 w-12 skeleton-shimmer" />
                <Skeleton className="h-4 w-12 skeleton-shimmer" />
                <Skeleton className="h-4 w-16 skeleton-shimmer" />
                <Skeleton className="h-4 w-16 skeleton-shimmer" />
              </div>
            ))}
          </div>
        ) : unitComparison.isError ? (
          <p className="text-sm text-text-secondary py-6 text-center px-4">
            Não foi possível carregar o comparativo.
          </p>
        ) : (unitComparison.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-text-secondary py-6 text-center px-4">
            Nenhuma unidade encontrada.
          </p>
        ) : (
          <BIUnitComparison
            rows={unitComparison.data!}
            months={selectedMonths}
          />
        )}
      </div>

      {/* ── Monthly Table ── */}
      <div className="rounded-xl border border-border-default bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary">
            Desempenho por Mês
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Baseado na data de criação do lead no Ploomes
          </p>
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-20 skeleton-shimmer" />
                <Skeleton className="h-4 w-10 skeleton-shimmer" />
                <Skeleton className="h-4 w-10 skeleton-shimmer" />
                <Skeleton className="h-4 w-12 skeleton-shimmer" />
                <Skeleton className="h-4 w-16 skeleton-shimmer" />
                <Skeleton className="h-4 w-16 skeleton-shimmer" />
                <Skeleton className="h-4 w-10 skeleton-shimmer" />
                <Skeleton className="h-4 w-10 skeleton-shimmer" />
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
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-border-default bg-surface-secondary">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wide whitespace-nowrap">
                    Mês
                  </th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wide whitespace-nowrap">
                    Leads
                  </th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wide whitespace-nowrap">
                    Ganhos
                  </th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wide whitespace-nowrap">
                    Conversão
                  </th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wide whitespace-nowrap">
                    Receita
                  </th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wide whitespace-nowrap">
                    Ticket Médio
                  </th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wide whitespace-nowrap">
                    Fechamento
                  </th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wide whitespace-nowrap">
                    Antecedência
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
                      {/* Mês */}
                      <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          {formatMonth(row.month)}
                          {isCurrent && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-800/40 dark:text-brand-300 border border-brand-200 dark:border-brand-700">
                              atual
                            </span>
                          )}
                        </span>
                      </td>

                      {/* Leads */}
                      <td className="px-3 py-3 text-right text-text-secondary tabular-nums">
                        {row.total_leads.toLocaleString('pt-BR')}
                      </td>

                      {/* Ganhos */}
                      <td className="px-3 py-3 text-right text-text-secondary tabular-nums">
                        {row.won_leads.toLocaleString('pt-BR')}
                      </td>

                      {/* Conversão */}
                      <td className="px-3 py-3 text-right font-semibold tabular-nums">
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

                      {/* Receita */}
                      <td className="px-3 py-3 text-right text-text-secondary tabular-nums whitespace-nowrap">
                        {row.total_revenue > 0
                          ? formatCurrencyCompact(row.total_revenue)
                          : <span className="text-text-tertiary">—</span>}
                      </td>

                      {/* Ticket Médio */}
                      <td className="px-3 py-3 text-right text-text-secondary tabular-nums whitespace-nowrap">
                        {row.avg_ticket != null
                          ? formatCurrencyCompact(row.avg_ticket)
                          : <span className="text-text-tertiary">—</span>}
                      </td>

                      {/* Fechamento */}
                      <td className="px-3 py-3 text-right text-text-secondary tabular-nums">
                        {row.avg_closing_days != null
                          ? `${Math.round(row.avg_closing_days)}d`
                          : <span className="text-text-tertiary">—</span>}
                      </td>

                      {/* Antecedência */}
                      <td className="px-4 py-3 text-right text-text-secondary tabular-nums">
                        {row.avg_booking_advance_days != null
                          ? `${Math.round(row.avg_booking_advance_days)}d`
                          : <span className="text-text-tertiary">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
        </TabsContent>

        {/* ── Atendimento (Deals) ── */}
        {canSeeSellers && (
          <TabsContent value="vendedoras" className="mt-6">
            <SellersTab
              units={units}
              activeUnitId={activeUnit?.id ?? null}
              activeUnitName={activeUnit?.name ?? 'Todas as unidades'}
            />
          </TabsContent>
        )}

        {/* ── Vendas Realizadas (Orders) ── */}
        {canSeeVendas && (
          <TabsContent value="vendas-realizadas" className="mt-6">
            <VendasRealizadasTab
              activeUnitId={activeUnit?.id ?? null}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
