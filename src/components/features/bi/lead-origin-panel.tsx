'use client'

// ============================================================
// LeadOriginPanel — Gráfico de barras empilhadas (% por mês)
// ============================================================
// Um painel por unidade. Renderizado dentro de LeadOriginSection.
// Usa stackOffset="expand" para normalizar 100% por mês —
// o eixo Y mostra porcentagem, não volume.
// Volume total está no rodapé do painel.
// ============================================================

import { useRef, useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { useLeadOriginBreakdown, type LeadOriginRow } from '@/hooks/use-lead-origin-breakdown'
import { ORIGIN_CATEGORIES, ORIGIN_COLOR_MAP } from '@/lib/bi/origin-categories'

// ── Constantes ────────────────────────────────────────────────

const CHART_H = 260
const AXIS    = '#94A3B8'   // slate-400 — legível em light + dark
const GRID    = 'rgba(148,163,184,0.15)'

// ── Chart width hook (ResizeObserver) ─────────────────────────

function useChartWidth(defaultWidth = 500) {
  const ref   = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(defaultWidth)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0) setWidth(entry.contentRect.width)
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return { ref, width }
}

// ── Helpers ───────────────────────────────────────────────────

/** 'YYYY-MM-DD' → 'Nov/25' */
function monthLabel(dateStr: string): string {
  const [year, month] = dateStr.split('-')
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${names[parseInt(month, 10) - 1]}/${year.slice(2)}`
}

// ── Pivot ─────────────────────────────────────────────────────
// RPC retorna linhas { month_start, category, total }.
// Pivotamos para { month: 'nov/25', Instagram: 169, Indicação: 46, ... }

type PivotRow = { month: string; [key: string]: string | number }

function pivotData(rows: LeadOriginRow[]): PivotRow[] {
  const monthMap = new Map<string, Record<string, number>>()
  for (const row of rows) {
    if (!monthMap.has(row.month_start)) monthMap.set(row.month_start, {})
    monthMap.get(row.month_start)![row.category] = row.total
  }
  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ms, cats]) => ({ month: monthLabel(ms), ...cats }))
}

// ── Top 3 categorias (total acumulado no período) ─────────────

function computeTop3(rows: LeadOriginRow[]): { key: string; total: number; pct: number; color: string }[] {
  const totals = new Map<string, number>()
  for (const row of rows) {
    totals.set(row.category, (totals.get(row.category) ?? 0) + row.total)
  }
  const grand = Array.from(totals.values()).reduce((a, b) => a + b, 0)
  return Array.from(totals.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([key, total]) => ({
      key,
      total,
      pct:   grand > 0 ? Math.round((total / grand) * 100) : 0,
      color: ORIGIN_COLOR_MAP[key] ?? '#71717A',
    }))
}

// ── Tooltip customizado ───────────────────────────────────────

// Tipagem permissiva para o content customizado do Recharts Tooltip
// (as props exatas variam por versão; alinhado com padrão do projeto)
type TooltipEntry = {
  dataKey:  string
  fill?:    string
  payload:  Record<string, number>
  value?:   number
}

interface OriginTooltipProps {
  active?:  boolean
  payload?: TooltipEntry[]
  label?:   string
}

function OriginTooltip({ active, payload, label }: OriginTooltipProps) {
  if (!active || !payload?.length) return null

  // Calcula total do mês a partir dos dados originais (não do valor normalizado)
  const monthTotal = payload.reduce(
    (sum: number, p: TooltipEntry) => sum + ((p.payload[p.dataKey] as number) ?? 0),
    0,
  )

  return (
    <div
      style={{
        background:   'var(--card)',
        border:       '1px solid var(--border)',
        borderRadius: 8,
        padding:      '10px 12px',
        fontSize:     12,
        minWidth:     180,
      }}
    >
      <p style={{ fontWeight: 600, marginBottom: 8, color: 'inherit' }}>{label}</p>

      {/* Itera na ordem de ORIGIN_CATEGORIES para consistência com o gráfico */}
      {ORIGIN_CATEGORIES.map(({ key, color }) => {
        const count = (payload[0]?.payload[key] ?? 0) as number
        if (count === 0) return null
        const pct = monthTotal > 0 ? (count / monthTotal * 100).toFixed(1) : '0.0'
        return (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span style={{ color: '#64748B', flex: 1, whiteSpace: 'nowrap' }}>{key}:</span>
            <span style={{ fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
              {pct}% ({count.toLocaleString('pt-BR')})
            </span>
          </div>
        )
      })}

      <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: AXIS }}>Total</span>
        <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {monthTotal.toLocaleString('pt-BR')}
        </span>
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────

function ChartSkeleton() {
  return <Skeleton className="w-full skeleton-shimmer rounded-lg" style={{ height: CHART_H }} />
}

// ── Componente principal ──────────────────────────────────────

interface Props {
  unitId:   string
  unitName: string
  months:   number
}

export function LeadOriginPanel({ unitId, unitName, months }: Props) {
  const { ref: chartRef, width: chartWidth } = useChartWidth()
  const { data: rows = [], isLoading, isError } = useLeadOriginBreakdown(unitId, months)

  const pivotedData = pivotData(rows)
  const totalLeads  = rows.reduce((sum, r) => sum + r.total, 0)
  const top3        = computeTop3(rows)

  return (
    <div className="rounded-xl border border-border-default bg-card p-4 space-y-3">
      {/* Cabeçalho da unidade */}
      <h3 className="text-sm font-semibold text-text-primary">{unitName}</h3>

      {/* Área do gráfico */}
      <div ref={chartRef} className="w-full">
        {isLoading ? (
          <ChartSkeleton />
        ) : isError ? (
          <div
            className="flex items-center justify-center text-sm text-text-tertiary"
            style={{ height: CHART_H }}
          >
            Não foi possível carregar os dados.
          </div>
        ) : pivotedData.length === 0 ? (
          <div
            className="flex items-center justify-center text-sm text-text-tertiary"
            style={{ height: CHART_H }}
          >
            Sem dados de origem para o período selecionado.
          </div>
        ) : (
          <BarChart
            width={chartWidth}
            height={CHART_H}
            data={pivotedData}
            stackOffset="expand"
            margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: AXIS }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
              domain={[0, 1]}
              tick={{ fontSize: 11, fill: AXIS }}
              axisLine={false}
              tickLine={false}
              width={38}
            />
            <Tooltip content={<OriginTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              iconSize={10}
              iconType="square"
            />
            {ORIGIN_CATEGORIES.map(({ key, color }) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="a"
                fill={color}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        )}
      </div>

      {/* Resumo: total + top 3 */}
      {!isLoading && !isError && rows.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-xs text-text-secondary">
            Total no período:{' '}
            <span className="font-semibold text-text-primary">
              {totalLeads.toLocaleString('pt-BR')} leads
            </span>
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {top3.map(({ key, total, pct, color }) => (
              <span key={key} className="flex items-center gap-1.5 text-xs text-text-secondary">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ background: color }}
                />
                <span className="font-medium text-text-primary">{key}</span>
                {pct}%{' '}
                <span className="text-text-tertiary">({total.toLocaleString('pt-BR')})</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
