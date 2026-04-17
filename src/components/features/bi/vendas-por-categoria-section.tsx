'use client'

import { useState, useRef, useEffect } from 'react'
import { Tag, ShoppingBag, TrendingUp, AlertCircle, RefreshCw, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import {
  useBiCategoryKpi,
  useBiCategoryRanking,
  useBiCategoryCrossUnit,
} from '@/hooks/use-bi-category'
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

/** "Cachola PINHEIROS" → "PIN", "Cachola MOEMA" → "MOE" */
function abbreviateFamily(family: string | null | undefined): string {
  if (!family) return '—'
  if (family.toUpperCase().includes('PINHEIROS')) return 'PIN'
  if (family.toUpperCase().includes('MOEMA'))     return 'MOE'
  return family
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
  const [groupByUnit,          setGroupByUnit]          = useState(false)
  const [drillCategory,        setDrillCategory]        = useState<string | null>(null)
  const [sheetOpen,            setSheetOpen]            = useState(false)
  const [crossUnitSheetOpen,   setCrossUnitSheetOpen]   = useState(false)

  const chartRef   = useRef<HTMLDivElement>(null)
  const chartWidth = useChartWidth(chartRef)

  const kpi       = useBiCategoryKpi({ startDate, endDate, unitId, includeInactive })
  const ranking   = useBiCategoryRanking({ startDate, endDate, unitId, includeInactive, groupByUnit })
  const crossUnit = useBiCategoryCrossUnit({ startDate, endDate, includeInactive })

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

  // Cross-unit aggregates
  const crossUnitRows       = crossUnit.data ?? []
  const hasCrossUnit        = crossUnitRows.length > 0
  const crossUnitItemCount  = crossUnitRows.reduce((s, r) => s + Number(r.item_count), 0)
  const crossUnitRevenue    = crossUnitRows.reduce((s, r) => s + Number(r.revenue), 0)

  // Dados para o gráfico horizontal
  const BAR_H       = 40
  const chartHeight = Math.max(160, rows.length * BAR_H + 24)
  const chartData   = rows.map((r) => ({
    name:  groupByUnit ? `${r.category} · ${abbreviateFamily(r.unit_family)}` : r.category,
    value: r.revenue,
    pct:   r.pct_of_total,
  }))

  const BAR_COLOR = '#7C8D78'

  return (
    <>
      <div className="space-y-5 pt-2">

        {/* ── Section header with toggle ─────────────────── */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border-default" />
          <div className="flex items-center gap-1.5 text-text-tertiary shrink-0">
            <Tag className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Vendas por Categoria de Produto
            </span>
          </div>
          <div className="h-px flex-1 bg-border-default" />
          <button
            onClick={() => setGroupByUnit((v) => !v)}
            className={cn(
              'shrink-0 text-xs px-2.5 py-0.5 rounded-full border transition-colors whitespace-nowrap',
              groupByUnit
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border-default text-text-secondary hover:text-text-primary'
            )}
          >
            por unidade
          </button>
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

        {/* ── Cross-unit alert card ──────────────────────── */}
        {hasCrossUnit && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/20 p-3 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Produtos com unidade divergente
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                {crossUnitItemCount.toLocaleString('pt-BR')} {crossUnitItemCount === 1 ? 'item' : 'itens'} ({formatCurrencyCompact(crossUnitRevenue)}) em que a unidade do pedido não coincide com a família do produto.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCrossUnitSheetOpen(true)}
              className="shrink-0 text-xs border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/40"
            >
              Ver detalhes
            </Button>
          </div>
        )}

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
                    <Cell key={i} fill={BAR_COLOR} fillOpacity={1 - i * 0.08} />
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
                {groupByUnit && (
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Unidade</th>
                )}
                <th className="text-right px-4 py-3 font-medium">Receita</th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Itens</th>
                <th className="text-right px-4 py-3 font-medium hidden md:table-cell">Ticket médio/item</th>
                <th className="text-right px-4 py-3 font-medium">% total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {rows.map((row, idx) => (
                <tr
                  key={`${row.category}|${row.unit_family ?? ''}`}
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
                  {groupByUnit && (
                    <td className="px-4 py-3 text-text-secondary hidden sm:table-cell text-xs">
                      {abbreviateFamily(row.unit_family)}
                    </td>
                  )}
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

      {/* ── Category drill-down sheet ──────────────────────── */}
      <CategoryDrilldownSheet
        category={drillCategory}
        startDate={startDate}
        endDate={endDate}
        unitId={unitId}
        includeInactive={includeInactive}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      {/* ── Cross-unit details sheet ───────────────────────── */}
      <Sheet open={crossUnitSheetOpen} onOpenChange={setCrossUnitSheetOpen}>
        <SheetContent
          side="right"
          showCloseButton
          className="w-full sm:max-w-lg flex flex-col gap-0 p-0"
        >
          <SheetHeader className="px-6 py-4 border-b border-border-default">
            <SheetTitle className="text-base font-semibold">
              Itens com Unidade Divergente
            </SheetTitle>
            <p className="text-xs text-text-tertiary mt-0.5">
              Pedidos em que a unidade de origem não coincide com a família do produto.
            </p>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            {crossUnitRows.length === 0 ? (
              <div className="py-12 text-center text-text-tertiary text-sm">
                Nenhuma divergência encontrada.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-secondary text-text-secondary sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium">Unidade do pedido</th>
                    <th className="text-left px-4 py-3 font-medium">Família do produto</th>
                    <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">Itens</th>
                    <th className="text-right px-4 py-3 font-medium">Receita</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {crossUnitRows.map((row, idx) => (
                    <tr key={idx} className="bg-card hover:bg-surface-secondary transition-colors">
                      <td className="px-4 py-3 text-text-primary">{row.order_unit_name}</td>
                      <td className="px-4 py-3 text-text-secondary">{row.product_family}</td>
                      <td className="px-4 py-3 text-right text-text-secondary hidden sm:table-cell">
                        {Number(row.item_count).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-text-primary">
                        {formatCurrency(row.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
