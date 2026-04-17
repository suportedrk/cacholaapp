'use client'

import { useState, useRef, useEffect } from 'react'
import { Tag, ShoppingBag, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useBiCategoryKpi, useBiCategoryRanking } from '@/hooks/use-bi-category'
import type { BICategoryRankingRow } from '@/hooks/use-bi-category'
import { CategoryDrilldownSheet } from './category-drilldown-sheet'

// ── Helpers ───────────────────────────────────────────────────

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

// ResizeObserver hook — mesma abordagem de sellers-charts.tsx
function useChartWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(300)
  useEffect(() => {
    if (!ref.current) return
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setWidth(w)
    })
    obs.observe(ref.current)
    setWidth(ref.current.offsetWidth)
    return () => obs.disconnect()
  }, [ref])
  return width
}

// ── Props ─────────────────────────────────────────────────────

interface Props {
  startDate:       string
  endDate:         string
  unitId:          string | null
  includeInactive: boolean
}

// ── Component ─────────────────────────────────────────────────

export function VendasPorCategoriaSection({
  startDate,
  endDate,
  unitId,
  includeInactive,
}: Props) {
  const [drillCategory, setDrillCategory] = useState<string | null>(null)
  const [sheetOpen,     setSheetOpen]     = useState(false)

  const chartRef   = useRef<HTMLDivElement>(null)
  const chartWidth = useChartWidth(chartRef)

  const kpi     = useBiCategoryKpi({ startDate, endDate, unitId, includeInactive })
  const ranking = useBiCategoryRanking({ startDate, endDate, unitId, includeInactive })

  const isLoading = kpi.isLoading || ranking.isLoading
  const isError   = kpi.isError   || ranking.isError

  function openDrill(row: BICategoryRankingRow) {
    setDrillCategory(row.category)
    setSheetOpen(true)
  }

  // ── Loading ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4 pt-2">
        <div className="h-px bg-border-default" />
        <div className="flex items-center gap-2">
          <Skeleton className="skeleton-shimmer h-5 w-52 rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="skeleton-shimmer h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="skeleton-shimmer h-48 w-full rounded-xl" />
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="space-y-4 pt-2">
        <div className="h-px bg-border-default" />
        <div className="flex flex-col items-center gap-3 py-10 text-text-secondary">
          <AlertCircle className="h-7 w-7 text-status-error-text" />
          <p className="text-sm">Erro ao carregar categorias.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { kpi.refetch(); ranking.refetch() }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  const kpiData = kpi.data ?? {
    total_categories:     0,
    top_category_name:    null,
    top_category_revenue: null,
    total_items:          0,
  }
  const rows = ranking.data ?? []

  if (rows.length === 0) return null

  // Dados para o gráfico horizontal
  const BAR_H      = 40
  const chartHeight = Math.max(160, rows.length * BAR_H + 24)
  const chartData   = rows.map((r) => ({
    name:    r.category,
    value:   r.revenue,
    pct:     r.pct_of_total,
  }))

  // Cores por posição (verde sálvia degradê, igual ao sellers-charts)
  const BAR_COLOR = '#7C8D78'

  return (
    <>
      <div className="space-y-5 pt-2">

        {/* ── Separador visual ──────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border-default" />
          <div className="flex items-center gap-1.5 text-text-tertiary">
            <Tag className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Vendas por Categoria de Produto
            </span>
          </div>
          <div className="h-px flex-1 bg-border-default" />
        </div>

        {/* ── KPI cards ─────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

          {/* 1. Nº de categorias */}
          <div className="rounded-xl border border-border-default bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-text-secondary">
              <Tag className="h-4 w-4" />
              <span className="text-xs font-medium">Categorias ativas</span>
            </div>
            <div className="text-2xl font-bold text-text-primary">
              {kpiData.total_categories}
            </div>
          </div>

          {/* 2. Categoria líder */}
          <div className="rounded-xl border border-border-default bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-text-secondary">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-medium">Categoria líder</span>
            </div>
            <div className="text-xl font-bold text-text-primary leading-snug">
              {formatCurrencyCompact(kpiData.top_category_revenue)}
            </div>
            {kpiData.top_category_name && (
              <p className="text-xs text-text-tertiary truncate">
                {kpiData.top_category_name}
              </p>
            )}
          </div>

          {/* 3. Total de itens vendidos */}
          <div className="rounded-xl border border-border-default bg-card p-4 space-y-1">
            <div className="flex items-center gap-2 text-text-secondary">
              <ShoppingBag className="h-4 w-4" />
              <span className="text-xs font-medium">Itens vendidos</span>
            </div>
            <div className="text-2xl font-bold text-text-primary">
              {kpiData.total_items.toLocaleString('pt-BR')}
            </div>
          </div>

        </div>

        {/* ── Gráfico: Receita por Categoria ─────────────── */}
        <div className="rounded-xl border border-border-default bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border-default">
            <h3 className="text-sm font-semibold text-text-primary">Receita por Categoria</h3>
            <p className="text-xs text-text-secondary mt-0.5">
              Soma do valor de produtos no período
            </p>
          </div>
          <div className="p-4">
            <div ref={chartRef} style={{ height: chartHeight }}>
              <BarChart
                width={chartWidth}
                height={chartHeight}
                data={chartData}
                layout="vertical"
                margin={{ top: 0, right: 72, bottom: 0, left: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={176}
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: string) => v.replace(' Cachola PINHEIROS', ' · PIN').replace(' Cachola MOEMA', ' · MOE')}
                />
                <Tooltip
                  cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
                  contentStyle={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any, _name: any, entry: any) => [
                    `${formatCurrency(value as number)} (${entry.payload.pct}%)`,
                    entry.payload.name,
                  ]}
                  labelFormatter={() => ''}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{
                  position: 'right',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter: (v: any) => formatCurrencyCompact(v as number),
                  fontSize: 11,
                  fill: '#94A3B8',
                }}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={BAR_COLOR} fillOpacity={1 - i * 0.1} />
                  ))}
                </Bar>
              </BarChart>
            </div>
          </div>
        </div>

        {/* ── Tabela: todas as categorias ────────────────── */}
        <div className="rounded-xl border border-border-default overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-secondary text-text-secondary">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Categoria</th>
                <th className="text-right px-4 py-3 font-medium">Receita</th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Itens</th>
                <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Ticket médio/item</th>
                <th className="text-right px-4 py-3 font-medium">% total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {rows.map((row, idx) => (
                <tr
                  key={row.category}
                  onClick={() => openDrill(row)}
                  className="bg-card hover:bg-surface-secondary transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-text-tertiary w-4 text-right shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-medium text-text-primary">{row.category}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-text-primary">
                    {formatCurrency(row.revenue)}
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary hidden sm:table-cell">
                    {row.product_count.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3 text-right text-text-secondary hidden md:table-cell">
                    {formatCurrency(row.avg_product_ticket)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center justify-end min-w-[3rem] text-xs font-semibold text-text-secondary">
                      {row.pct_of_total}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {/* ── Drill-down sheet ──────────────────────────────── */}
      <CategoryDrilldownSheet
        category={drillCategory}
        startDate={startDate}
        endDate={endDate}
        unitId={unitId}
        includeInactive={includeInactive}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  )
}
