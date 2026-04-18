'use client'

import { useState } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { useUnitStore } from '@/stores/unit-store'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { hasRole, VENDAS_MANAGE_ROLES } from '@/config/roles'
import { useVendasMyKpis, useVendasDailyRevenue, useVendasRanking } from '@/hooks/use-vendas'
import { buildVendasPeriods } from '../shared/period-types'
import type { VendasPeriodKey } from '../shared/period-types'
import { PeriodPills } from './period-pills'
import { SellerSelector } from './seller-selector'
import { KpiCards } from './kpi-cards'
import { MetaPlaceholder } from './meta-placeholder'
import { RevenueChart } from './revenue-chart'
import { RankingTable } from './ranking-table'

export function MeuPainelClient() {
  const { profile } = useAuth()
  const activeUnitId = useUnitStore((s) => s.activeUnitId)

  const isManager   = hasRole(profile?.role, VENDAS_MANAGE_ROLES)
  const isVendedora = profile?.role === 'vendedora'

  const [periods] = useState(() => buildVendasPeriods())
  const [periodKey, setPeriodKey] = useState<VendasPeriodKey>('mes_atual')
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null)

  const period = periods.find((p: { key: VendasPeriodKey }) => p.key === periodKey) ?? periods[0]

  // For vendedora, always use their seller_id. Managers use selectedSellerId (null = all).
  const effectiveSellerId = isVendedora
    ? (profile?.seller_id ?? null)
    : selectedSellerId

  const kpisQuery = useVendasMyKpis({
    sellerId:  effectiveSellerId,
    startDate: period.startDate,
    endDate:   period.endDate,
    prevStart: period.prevStart,
    prevEnd:   period.prevEnd,
  })

  const chartQuery = useVendasDailyRevenue({
    sellerId:  effectiveSellerId,
    startDate: period.startDate,
    endDate:   period.endDate,
  })

  const rankingQuery = useVendasRanking({
    startDate: period.startDate,
    endDate:   period.endDate,
    unitId:    activeUnitId,
  })

  const isLoading = kpisQuery.isLoading || chartQuery.isLoading || rankingQuery.isLoading
  const { isTimedOut, retry } = useLoadingTimeout(isLoading)

  const isError = kpisQuery.isError || chartQuery.isError || rankingQuery.isError

  // Own seller name to highlight row (vendedora only)
  const mySellerName = isVendedora && profile?.seller_id
    ? (rankingQuery.data?.find((r) => r.seller_id === profile.seller_id)?.seller_name ?? null)
    : null

  if (isTimedOut) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-text-secondary">
        <AlertCircle className="w-8 h-8 text-status-error-text" />
        <p className="text-sm">O carregamento demorou mais que o esperado.</p>
        <Button variant="outline" size="sm" onClick={retry} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (isError && !isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-text-secondary">
        <AlertCircle className="w-8 h-8 text-status-error-text" />
        <p className="text-sm">Erro ao carregar dados. Tente novamente.</p>
        <Button variant="outline" size="sm" onClick={retry} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Tentar novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        <PeriodPills
          periods={periods}
          selected={periodKey}
          onChange={setPeriodKey}
        />
        {isManager && (
          <SellerSelector
            sellers={rankingQuery.data ?? []}
            value={selectedSellerId}
            onChange={setSelectedSellerId}
          />
        )}
      </div>

      {/* KPI cards */}
      <KpiCards kpis={kpisQuery.data} isLoading={kpisQuery.isLoading} />

      {/* Meta placeholder */}
      <MetaPlaceholder />

      {/* Revenue chart */}
      <RevenueChart rows={chartQuery.data ?? []} isLoading={chartQuery.isLoading} />

      {/* Ranking */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-text-primary">Ranking do período</h2>
        <RankingTable
          rows={rankingQuery.data ?? []}
          isLoading={rankingQuery.isLoading}
          canDrilldown={isManager}
          mySellerName={mySellerName}
          startDate={period.startDate}
          endDate={period.endDate}
          unitId={activeUnitId}
        />
      </div>
    </div>
  )
}
