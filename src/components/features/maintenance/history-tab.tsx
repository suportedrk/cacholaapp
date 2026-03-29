'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  CheckCircle2, Clock, DollarSign, TrendingUp,
  Download, FileSpreadsheet, Loader2, History,
} from 'lucide-react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FilterChip } from '@/components/shared/filter-chip'
import { EmptyState } from '@/components/shared/empty-state'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { HistoryTimeline, HistoryTimelineSkeleton } from './history-timeline'
import {
  useMaintenanceHistory, useHistorySummary,
  formatResolutionTime,
  type HistoryFilters,
} from '@/hooks/use-maintenance-history'
import { useSectors } from '@/hooks/use-sectors'
import { useSuppliers } from '@/hooks/use-suppliers'
import { exportToExcel, exportReportPDF } from '@/lib/utils/export'
import { formatBRL } from '@/hooks/use-maintenance-costs'
import type { MaintenanceType } from '@/types/database.types'
import { BRAND_GREEN } from '@/lib/constants/brand-colors'

// ─────────────────────────────────────────────────────────────
// TYPE FILTER CHIPS
// ─────────────────────────────────────────────────────────────
const TYPE_CHIPS: { value: MaintenanceType; label: string; color: 'red' | 'amber' | 'green' | 'blue' }[] = [
  { value: 'emergency', label: 'Emergencial', color: 'red'   },
  { value: 'punctual',  label: 'Pontual',     color: 'amber' },
  { value: 'recurring', label: 'Recorrente',  color: 'green' },
  { value: 'preventive',label: 'Preventiva',  color: 'blue'  },
]

// ─────────────────────────────────────────────────────────────
// KPI CARD
// ─────────────────────────────────────────────────────────────
function KpiCard({
  icon: Icon, label, value, sub, color,
}: {
  icon:   React.ElementType
  label:  string
  value:  string | number
  sub?:   string
  color?: 'green' | 'blue' | 'amber' | 'default'
}) {
  const colorMap = {
    green:   'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800',
    blue:    'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800',
    amber:   'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800',
    default: 'bg-card border-border',
  }
  const iconMap = {
    green:   'icon-green',
    blue:    'icon-blue',
    amber:   'icon-amber',
    default: 'text-muted-foreground',
  }
  const valueMap = {
    green:   'text-green-700 dark:text-green-400',
    blue:    'text-blue-700 dark:text-blue-400',
    amber:   'text-amber-700 dark:text-amber-400',
    default: 'text-foreground',
  }
  const c = color ?? 'default'

  return (
    <div className={`rounded-xl border p-3 flex flex-col gap-2 ${colorMap[c]}`}>
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg bg-white/60 dark:bg-black/20 flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconMap[c]}`} />
        </div>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className={`text-xl font-bold leading-tight tabular-nums ${valueMap[c]}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground -mt-1">{sub}</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// HISTORY TAB
// ─────────────────────────────────────────────────────────────
export function HistoryTab() {
  const [filters, setFilters] = useState<HistoryFilters>({})
  const [isExporting, setIsExporting] = useState(false)

  const { data: summary, isLoading: summaryLoading } = useHistorySummary(filters)
  const {
    data: listData,
    isLoading: listLoading,
    isError: listError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMaintenanceHistory(filters)

  const { data: sectors = [] } = useSectors(true)
  const { data: supplierData } = useSuppliers({ isActive: true })
  const suppliers = supplierData ?? []

  // Flatten pages
  const allItems = useMemo(
    () => listData?.pages.flat() ?? [],
    [listData]
  )

  // Toggle type filter
  const toggleType = useCallback((t: MaintenanceType) => {
    setFilters((f) => {
      const prev = f.type ?? []
      const next = prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
      return { ...f, type: next.length ? next : undefined }
    })
  }, [])

  // ── Export Excel ─────────────────────────────────────────
  async function handleExcelExport() {
    if (!allItems.length) return
    setIsExporting(true)
    try {
      await exportToExcel(
        allItems.map((o) => ({
          titulo:          o.title,
          tipo:            o.type,
          setor:           o.sector?.name ?? '',
          fornecedor:      o.supplier?.company_name ?? '',
          aberta_em:       o.created_at ? new Date(o.created_at).toLocaleDateString('pt-BR') : '',
          concluida_em:    o.completed_at ? new Date(o.completed_at).toLocaleDateString('pt-BR') : '',
        })),
        [
          { key: 'titulo',       header: 'Título'        },
          { key: 'tipo',         header: 'Tipo'          },
          { key: 'setor',        header: 'Setor'         },
          { key: 'fornecedor',   header: 'Fornecedor'    },
          { key: 'aberta_em',    header: 'Aberta em'     },
          { key: 'concluida_em', header: 'Concluída em'  },
        ],
        'historico-manutencao'
      )
    } finally {
      setIsExporting(false)
    }
  }

  // ── Export PDF ────────────────────────────────────────────
  async function handlePdfExport() {
    if (!allItems.length) return
    setIsExporting(true)
    try {
      await exportReportPDF({
        title:    'Histórico de Manutenções',
        unitName: '',
        period:   '',
        filename: 'historico-manutencao',
        columns: [
          { key: 'titulo',       header: 'Título',        width: 70 },
          { key: 'tipo',         header: 'Tipo',          width: 25 },
          { key: 'setor',        header: 'Setor',         width: 30 },
          { key: 'concluida_em', header: 'Concluída em',  width: 30, align: 'center' },
        ],
        rows: allItems.map((o) => ({
          titulo:       o.title,
          tipo:         o.type,
          setor:        o.sector?.name ?? '—',
          concluida_em: o.completed_at
            ? new Date(o.completed_at).toLocaleDateString('pt-BR')
            : '—',
        })),
      })
    } finally {
      setIsExporting(false)
    }
  }

  const isLoading = summaryLoading || listLoading

  // ── KPI values ────────────────────────────────────────────
  const kpis = summary?.kpis
  const avgResText = kpis?.avg_resolution_hours != null
    ? formatResolutionTime(kpis.avg_resolution_hours)
    : '—'

  return (
    <div className="space-y-5">
      {/* ── KPI Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          icon={CheckCircle2}
          label="Concluídas"
          value={summaryLoading ? '…' : (kpis?.total_completed ?? 0)}
          sub="no período filtrado"
          color="green"
        />
        <KpiCard
          icon={Clock}
          label="Tempo médio"
          value={summaryLoading ? '…' : avgResText}
          sub="para resolver"
          color="blue"
        />
        <KpiCard
          icon={DollarSign}
          label="Custo aprovado"
          value={summaryLoading ? '…' : (kpis ? formatBRL(kpis.total_cost_approved) : '—')}
          sub="no período filtrado"
          color="amber"
        />
        <KpiCard
          icon={TrendingUp}
          label="Custo médio/OS"
          value={summaryLoading ? '…' : (kpis?.avg_cost_per_order != null ? formatBRL(kpis.avg_cost_per_order) : '—')}
          color="default"
        />
      </div>

      {/* ── Trend Chart ────────────────────────────────────── */}
      {summary?.by_month && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground mb-3">Tendência — Últimos 12 meses</p>
          <ResponsiveContainer width="100%" height={180}>
            <ComposedChart data={summary.by_month} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={28}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value, name) =>
                  name === 'Custo' ? [formatBRL(Number(value)), name] : [value, name]
                }
              />
              <Legend
                iconSize={8}
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              />
              <Bar
                yAxisId="left"
                dataKey="count"
                name="Concluídas"
                fill={BRAND_GREEN[500]}
                radius={[3, 3, 0, 0]}
                maxBarSize={32}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cost"
                name="Custo"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Filters + Export ───────────────────────────────── */}
      <div className="space-y-3">
        {/* Date range */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Período:</span>
          <Input
            type="date"
            className="h-8 text-xs w-36"
            value={filters.date_from ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value || undefined }))}
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            className="h-8 text-xs w-36"
            value={filters.date_to ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value || undefined }))}
          />
          {(filters.date_from || filters.date_to) && (
            <button
              type="button"
              onClick={() => setFilters((f) => ({ ...f, date_from: undefined, date_to: undefined }))}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Limpar
            </button>
          )}
        </div>

        {/* Type chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Tipo:</span>
          {TYPE_CHIPS.map(({ value, label, color }) => (
            <FilterChip
              key={value}
              label={label}
              color={color}
              active={(filters.type ?? []).includes(value)}
              onClick={() => toggleType(value)}
            />
          ))}
        </div>

        {/* Sector + Supplier selects */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Setor:</span>
          <Select
            value={filters.sector_id ?? '__all__'}
            onValueChange={(v) => setFilters((f) => ({ ...f, sector_id: v === '__all__' ? undefined : (v ?? undefined) }))}
          >
            <SelectTrigger className="h-8 text-xs w-40">
              <SelectValue placeholder="Todos os setores" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os setores</SelectItem>
              {sectors.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="text-xs text-muted-foreground">Fornecedor:</span>
          <Select
            value={filters.supplier_id ?? '__all__'}
            onValueChange={(v) => setFilters((f) => ({ ...f, supplier_id: v === '__all__' ? undefined : (v ?? undefined) }))}
          >
            <SelectTrigger className="h-8 text-xs w-44">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.company_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Export buttons */}
        {allItems.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handleExcelExport}
              disabled={isExporting}
            >
              {isExporting
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <FileSpreadsheet className="w-3.5 h-3.5" />
              }
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={handlePdfExport}
              disabled={isExporting}
            >
              {isExporting
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Download className="w-3.5 h-3.5" />
              }
              PDF
            </Button>
          </div>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────── */}
      {listError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive text-center">
          Erro ao carregar histórico. Tente recarregar a página.
        </div>
      ) : isLoading ? (
        <HistoryTimelineSkeleton count={6} />
      ) : allItems.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nenhuma ordem concluída"
          description="O histórico de manutenções concluídas aparecerá aqui. Ajuste os filtros ou aguarde a conclusão de ordens abertas."
        />
      ) : (
        <>
          <HistoryTimeline items={allItems} />

          {/* Load more */}
          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                {isFetchingNextPage ? 'Carregando…' : `Carregar mais`}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
