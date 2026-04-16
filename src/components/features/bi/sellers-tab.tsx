'use client'

import { useState, useCallback } from 'react'
import { Download, Loader2, Users2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SellersRankingTable } from './sellers-ranking-table'
import { SellersCharts } from './sellers-charts'
import { SellerDrilldownSheet } from './seller-drilldown-sheet'
import { useBISellersRanking } from '@/hooks/use-bi-sellers-ranking'
import { exportSellersReport } from '@/lib/bi/export-sellers-report'
import { Skeleton } from '@/components/ui/skeleton'

// ── Period options ────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { label: '3M',   value: 3  },
  { label: '6M',   value: 6  },
  { label: '12M',  value: 12 },
  { label: 'Tudo', value: 24 },
] as const

type PeriodValue = typeof PERIOD_OPTIONS[number]['value']

// ── Units ─────────────────────────────────────────────────────

interface UnitOption { id: string; name: string }

// ── Props ─────────────────────────────────────────────────────

interface Props {
  /** Available units for the unit toggle (from UnitStore) */
  units: UnitOption[]
  /** Currently active unit ID (null = all) */
  activeUnitId: string | null
  /** Unit name for export filename */
  activeUnitName: string
}

// ── Component ─────────────────────────────────────────────────

export function SellersTab({ units, activeUnitId, activeUnitName }: Props) {
  const [selectedMonths, setSelectedMonths] = useState<PeriodValue>(6)
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(activeUnitId)
  const [selectedSeller, setSelectedSeller] = useState<string | null>(null)
  const [isExporting, setIsExporting]       = useState(false)

  const ranking = useBISellersRanking(selectedUnitId, selectedMonths)

  // For export: fetch history for all sellers in ranking
  const handleExport = useCallback(async () => {
    const rows = ranking.data ?? []
    if (rows.length === 0) return
    setIsExporting(true)
    try {
      // We build the history map from already-cached data if available
      // For export we use a simple inline fetch via Supabase RPC
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const historyMap = new Map<string, { month_label: string; leads_count: number; won_count: number; revenue: number; avg_days_to_close: number | null }[]>()

      await Promise.all(
        rows.map(async (r) => {
          const { data } = await supabase.rpc('get_bi_seller_history', {
            p_owner_name:    r.owner_name,
            p_unit_id:       selectedUnitId ?? null,
            p_period_months: selectedMonths,
          })
          historyMap.set(r.owner_name, (data ?? []) as { month_label: string; leads_count: number; won_count: number; revenue: number; avg_days_to_close: number | null }[])
        }),
      )

      await exportSellersReport({
        ranking: rows,
        historyMap,
        unitName:     activeUnitName,
        periodMonths: selectedMonths,
        exportDate:   new Date(),
      })
    } finally {
      setIsExporting(false)
    }
  }, [ranking.data, selectedUnitId, selectedMonths, activeUnitName])

  const selectedSellerRow = ranking.data?.find((r) => r.owner_name === selectedSeller) ?? null

  return (
    <div className="space-y-4">

      {/* ── Filters bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Period pills */}
          <div className="flex items-center gap-0.5 bg-surface-secondary rounded-lg p-0.5 border border-border-default">
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

          {/* Unit toggle */}
          {units.length > 1 && (
            <div className="flex items-center gap-0.5 bg-surface-secondary rounded-lg p-0.5 border border-border-default">
              <button
                onClick={() => setSelectedUnitId(null)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-semibold transition-colors',
                  selectedUnitId === null
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-tertiary',
                )}
              >
                Ambas
              </button>
              {units.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUnitId(u.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-semibold transition-colors',
                    selectedUnitId === u.id
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-tertiary',
                  )}
                >
                  {u.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Export button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={!ranking.data?.length || isExporting}
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

      {/* ── Seção 1: Ranking table ── */}
      <div className="rounded-xl border border-border-default bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border-default flex items-center gap-2">
          <Users2 className="w-4 h-4 text-text-tertiary" />
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Ranking de Vendedoras</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Clique em uma linha para ver o detalhe individual
            </p>
          </div>
        </div>

        {ranking.isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-8 h-8 rounded-full skeleton-shimmer" />
                <Skeleton className="h-4 flex-1 skeleton-shimmer" />
                <Skeleton className="h-4 w-12 skeleton-shimmer" />
                <Skeleton className="h-4 w-16 skeleton-shimmer" />
              </div>
            ))}
          </div>
        ) : ranking.isError ? (
          <div className="p-6 text-center text-sm text-text-secondary">
            Não foi possível carregar o ranking. Verifique a conexão.
          </div>
        ) : (
          <SellersRankingTable
            rows={ranking.data ?? []}
            onSelectSeller={(name) => setSelectedSeller(name)}
          />
        )}
      </div>

      {/* ── Seção 2: Gráficos comparativos ── */}
      {!ranking.isLoading && (ranking.data?.length ?? 0) > 0 && (
        <SellersCharts rows={ranking.data!} />
      )}

      {/* ── Seção 3: Drill-down Sheet ── */}
      <SellerDrilldownSheet
        isOpen={!!selectedSeller}
        onClose={() => setSelectedSeller(null)}
        seller={selectedSellerRow}
        unitId={selectedUnitId}
        periodMonths={selectedMonths}
      />
    </div>
  )
}
