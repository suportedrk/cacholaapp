'use client'

import { Users, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { InfoPopover } from '@/components/ui/info-popover'
import { cn } from '@/lib/utils'
import { useBiAdoptionKpi, useBiAdoptionRanking } from '@/hooks/use-bi-adoption'

interface Props {
  startDate:       string
  endDate:         string
  unitId:          string | null
  includeInactive: boolean
}

function AdoptionBar({ value }: { value: number }) {
  const color =
    value >= 80 ? 'bg-status-success-text' :
    value >= 50 ? 'bg-amber-500' :
                  'bg-status-error-text'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-border-default rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-xs font-semibold tabular-nums w-10 text-right">
        {value.toFixed(1)}%
      </span>
    </div>
  )
}

export function BiAdoptionCard({ startDate, endDate, unitId, includeInactive }: Props) {
  const kpi     = useBiAdoptionKpi({ startDate, endDate, unitId, includeInactive })
  const ranking = useBiAdoptionRanking({ startDate, endDate, unitId, includeInactive })

  const isLoading = kpi.isLoading || ranking.isLoading
  const isError   = kpi.isError   || ranking.isError

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="skeleton-shimmer h-20 rounded-xl" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="skeleton-shimmer h-8 rounded-lg" />)}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-text-secondary">
        <AlertCircle className="h-6 w-6 text-status-error-text" />
        <p className="text-sm">Erro ao carregar dados de adoção.</p>
        <Button variant="outline" size="sm" onClick={() => { kpi.refetch(); ranking.refetch() }}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      </div>
    )
  }

  const kpiData = kpi.data ?? { total_orders: 0, orders_preenchidas: 0, percentual_adocao: 0 }
  const rows    = ranking.data ?? []

  const badgeColor =
    kpiData.percentual_adocao >= 80 ? 'badge-green' :
    kpiData.percentual_adocao >= 50 ? 'badge-amber' :
                                       'badge-red'

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wide">
          Adoção — Convidados Contratados
        </p>
        <InfoPopover ariaLabel="Informações sobre Adoção de Convidados Contratados">
          <div className="space-y-2 text-sm text-text-secondary">
            <p className="font-semibold text-text-primary">% de Preenchimento</p>
            <p>
              Percentual de orders do período que têm o campo{' '}
              <span className="font-medium text-text-primary">Convidados Contratados</span>{' '}
              preenchido no Ploomes.
            </p>
            <p>
              Esse campo é necessário para o cálculo correto de indicadores por tamanho de festa.
              Meta recomendada: ≥ 80%.
            </p>
          </div>
        </InfoPopover>
      </div>

      {/* KPI summary card */}
      <div className="rounded-xl border border-border-default bg-card p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="icon-blue p-2 rounded-lg">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-text-primary">
                {kpiData.percentual_adocao.toFixed(1)}%
              </div>
              <div className="text-xs text-text-tertiary">
                {kpiData.orders_preenchidas.toLocaleString('pt-BR')} de{' '}
                {kpiData.total_orders.toLocaleString('pt-BR')} orders
              </div>
            </div>
          </div>
          <Badge variant="outline" className={cn(badgeColor, 'border text-xs')}>
            {kpiData.percentual_adocao >= 80
              ? 'Meta atingida'
              : kpiData.percentual_adocao >= 50
              ? 'Em progresso'
              : 'Abaixo da meta'}
          </Badge>
        </div>

        {/* Global bar */}
        <div className="mt-3">
          <AdoptionBar value={kpiData.percentual_adocao} />
        </div>
      </div>

      {/* Ranking por vendedora */}
      {rows.length > 0 && (
        <div className="rounded-lg border border-border-default overflow-hidden">
          <div className="bg-surface-secondary px-4 py-2 flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-text-tertiary" />
            <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
              Por vendedora
            </span>
          </div>
          <div className="divide-y divide-border-default">
            {rows.map((row) => (
              <div key={row.seller_id} className="px-4 py-3 bg-card">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-text-primary truncate">
                      {row.seller_name}
                    </span>
                    {row.is_system_account && (
                      <Badge variant="outline" className="badge-amber border text-xs shrink-0">
                        sistema
                      </Badge>
                    )}
                    {!row.is_system_account && row.seller_status === 'inactive' && (
                      <Badge variant="outline" className="badge-gray border text-xs shrink-0">
                        inativa
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-text-tertiary shrink-0">
                    {row.orders_preenchidas}/{row.total_orders}
                  </span>
                </div>
                <AdoptionBar value={row.percentual_adocao} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
