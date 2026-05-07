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
import { LeadOriginSection } from '@/components/features/bi/lead-origin-section'
import { BIBreakdownByUnit } from '@/components/features/bi/bi-breakdown-by-unit'
import { exportBIReport } from '@/lib/bi/export-bi-report'
import { BI_ATENDIMENTO_ROLES, BI_VENDAS_ROLES, hasRole } from '@/config/roles'
import { InfoPopover } from '@/components/ui/info-popover'

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

  // ── Period aggregate KPIs ─────────────────────────────────
  // hooks request selectedMonths+1 months; rows[0] is the extra "delta" month.
  // slice(1) gives the actual selected period for aggregation.
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

  const convValue    = periodConvRate != null ? `${periodConvRate.toFixed(1)}%` : '—'
  const closingValue = periodClosing  != null ? `${Math.round(periodClosing)} dias` : '—'
  const ticketValue  = formatCurrency(periodTicket != null && periodTicket > 0 ? periodTicket : null)
  const revenueValue = formatCurrencyCompact(periodRevenue > 0 ? periodRevenue : null)

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
              href="/bi"
              infoContent={
                <div className="space-y-2 text-sm text-text-secondary">
                  <p className="font-semibold text-text-primary">Taxa de Conversão</p>
                  <p>Percentual de leads que se tornaram festas fechadas no período selecionado.</p>
                  <p>Um lead é considerado <span className="font-medium text-text-primary">convertido</span> quando o deal no Ploomes está com status &quot;Ganho&quot; ou na etapa &quot;Festa Fechada&quot;.</p>
                  <p className="text-text-tertiary text-xs">Referência: data de criação do deal no Ploomes.</p>
                </div>
              }
            />

            {/* 2. Tempo Médio de Fechamento */}
            <KpiCard
              label="Tempo Médio de Fechamento"
              value={closingValue}
              icon={Clock}
              iconClass="icon-blue"
              strokeColor="#6B9E8B"
              spark={salesMetrics.data?.sparkClosing ?? []}
              invertTrend
              href="/bi"
              infoContent={
                <div className="space-y-2 text-sm text-text-secondary">
                  <p className="font-semibold text-text-primary">Tempo Médio de Fechamento</p>
                  <p>Média de dias entre a criação do lead no Ploomes e a data do último update do deal (proxy para data de fechamento).</p>
                  <p>Calculado apenas sobre deals <span className="font-medium text-text-primary">ganhos</span> no período. Quanto menor, mais ágil é o ciclo de vendas.</p>
                  <p className="text-text-tertiary text-xs">⚠️ Como usamos a data de última atualização, deals editados após o fechamento podem distorcer levemente este número.</p>
                </div>
              }
            />

            {/* 3. Ticket Médio */}
            <KpiCard
              label="Ticket Médio"
              value={ticketValue}
              icon={Banknote}
              iconClass="icon-green"
              strokeColor={CHART_COLORS.eventConfirmed}
              spark={salesMetrics.data?.sparkTicket ?? []}
              href="/bi"
              infoContent={
                <div className="space-y-2 text-sm text-text-secondary">
                  <p className="font-semibold text-text-primary">Ticket Médio</p>
                  <p>Valor médio por festa fechada: receita total ÷ número de deals ganhos no período.</p>
                  <p>Baseado no <span className="font-medium text-text-primary">valor negociado</span> registrado no Ploomes (campo &quot;Valor do Deal&quot;), que pode incluir descontos aplicados.</p>
                  <p className="text-text-tertiary text-xs">Diferente do ticket médio de pedidos (Vendas Realizadas), que usa os produtos efetivamente comprados.</p>
                </div>
              }
            />

            {/* 4. Receita do Período */}
            <KpiCard
              label="Receita do Período"
              value={revenueValue}
              icon={TrendingUp}
              iconClass="icon-amber"
              strokeColor="#D4A858"
              spark={salesMetrics.data?.sparkRevenue ?? []}
              href="/bi"
              infoContent={
                <div className="space-y-2 text-sm text-text-secondary">
                  <p className="font-semibold text-text-primary">Receita do Período</p>
                  <p>Soma dos valores negociados de todos os deals <span className="font-medium text-text-primary">ganhos</span> cujo lead foi criado no período selecionado.</p>
                  <p>Usa o valor do deal no Ploomes (valor negociado com o cliente). Deals sem valor preenchido não entram na soma.</p>
                  <p className="text-text-tertiary text-xs">Para ver a receita por produto (preço de tabela), consulte a aba Vendas Realizadas.</p>
                </div>
              }
            />
          </>
        )}
      </div>

      {/* ── Breakdown by unit (only when "Todas as unidades" is selected) ── */}
      {!activeUnit && units.length > 1 && !isLoading && (
        <BIBreakdownByUnit units={units} months={selectedMonths} />
      )}

      {/* ── Insight: Antecedência de Reserva ── */}
      {!isLoading && (
        <div className="rounded-xl border border-border-default bg-surface-secondary px-4 py-3 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg icon-brand flex items-center justify-center shrink-0 mt-0.5">
            <CalendarClock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-text-primary">
                Antecedência Média de Reserva
              </p>
              <InfoPopover ariaLabel="Informações sobre Antecedência Média de Reserva">
                <div className="space-y-2 text-sm text-text-secondary">
                  <p className="font-semibold text-text-primary">Antecedência Média de Reserva</p>
                  <p>Média de dias entre a criação do lead no Ploomes e a data da festa — indica com quanto tempo de antecedência os clientes costumam reservar.</p>
                  <p>Calculado apenas sobre deals <span className="font-medium text-text-primary">ganhos</span> que têm data de festa preenchida.</p>
                  <p className="text-text-tertiary text-xs">⚠️ Deals sem data de festa cadastrada no Ploomes são excluídos deste cálculo.</p>
                </div>
              </InfoPopover>
            </div>
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
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-text-primary">Funil do Pipeline</h2>
              <InfoPopover ariaLabel="Informações sobre Funil do Pipeline">
                <div className="space-y-2 text-sm text-text-secondary">
                  <p className="font-semibold text-text-primary">Funil do Pipeline</p>
                  <p>Distribuição <span className="font-medium text-text-primary">acumulada</span> de todos os deals por etapa do pipeline no Ploomes — independente do período selecionado.</p>
                  <p>A barra mostra a proporção de deals em cada etapa em relação ao total. Etapas finais (Ganho, Festa Fechada) representam os negócios convertidos.</p>
                  <p className="text-text-tertiary text-xs">Clique em qualquer etapa para ver a lista de deals nela.</p>
                </div>
              </InfoPopover>
            </div>
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
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-text-primary">Comparativo entre Unidades</h2>
              <InfoPopover ariaLabel="Informações sobre Comparativo entre Unidades">
                <div className="space-y-2 text-sm text-text-secondary">
                  <p className="font-semibold text-text-primary">Comparativo entre Unidades</p>
                  <p>Tabela lado a lado com as métricas de cada unidade no período selecionado: leads, conversão, ticket médio, receita e tempo de fechamento.</p>
                  <p>Disponível somente para usuários com acesso a múltiplas unidades. Selecionar uma unidade específica no seletor superior oculta esta tabela.</p>
                </div>
              </InfoPopover>
            </div>
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
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold text-text-primary">
              Desempenho por Mês
            </h2>
            <InfoPopover ariaLabel="Informações sobre Desempenho por Mês">
              <div className="space-y-2 text-sm text-text-secondary">
                <p className="font-semibold text-text-primary">Desempenho por Mês</p>
                <p>Série histórica mensal com leads, conversão, receita, ticket médio, tempo de fechamento e antecedência de reserva.</p>
                <p>Cada linha representa os deals cujo lead foi <span className="font-medium text-text-primary">criado naquele mês</span> no Ploomes — não a data da festa.</p>
                <p className="text-text-tertiary text-xs">O mês atual pode estar incompleto. Os dados são atualizados a cada 30 minutos via sync com o Ploomes.</p>
              </div>
            </InfoPopover>
          </div>
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

        {/* ── Origem dos Leads ── */}
        <LeadOriginSection units={units} months={selectedMonths} />

        </TabsContent>

        {/* ── Atendimento (Deals) ── */}
        {canSeeSellers && (
          <TabsContent value="vendedoras" className="mt-6">
            <SellersTab units={units} />
          </TabsContent>
        )}

        {/* ── Vendas Realizadas (Orders) ── */}
        {canSeeVendas && (
          <TabsContent value="vendas-realizadas" className="mt-6">
            <VendasRealizadasTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
