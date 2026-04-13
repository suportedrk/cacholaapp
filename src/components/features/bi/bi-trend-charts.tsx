'use client'

import { useRef, useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import type { BIConversionRow } from '@/hooks/use-bi-conversion'
import type { SalesMetricsDataPoint } from '@/hooks/use-bi-sales-metrics'

// ── Colors (hex — Recharts cannot use CSS vars in chart elements) ─────────────
const C = {
  conversion: '#22c55e',   // green-500
  revenue:    '#f59e0b',   // amber-500
  grid:       'rgba(148,163,184,0.15)',
  axis:       '#94A3B8',   // slate-400 — legible on both light + dark
}

// ── Chart width hook (ResizeObserver) ─────────────────────────────────────────
function useChartWidth(defaultWidth = 500) {
  const ref = useRef<HTMLDivElement>(null)
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function monthLabel(yyyyMM: string): string {
  const [year, month] = yyyyMM.split('-')
  const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${names[parseInt(month, 10) - 1]}/${year.slice(2)}`
}

function fmtCurrencyCompact(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(0)}k`
  return `R$ ${v.toFixed(0)}`
}

function fmtCurrencyFull(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v)
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  conversionRows: BIConversionRow[]       // oldest → newest
  salesRows:      SalesMetricsDataPoint[] // oldest → newest
  isLoading:      boolean
}

// ── Chart skeleton ────────────────────────────────────────────────────────────

function ChartSkeleton() {
  return <Skeleton className="w-full h-[280px] skeleton-shimmer rounded-lg" />
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BITrendCharts({ conversionRows, salesRows, isLoading }: Props) {
  const { ref: convRef, width: convWidth } = useChartWidth()
  const { ref: revRef,  width: revWidth  } = useChartWidth()

  const convData = conversionRows.map((r) => ({
    monthLabel:      monthLabel(r.month),
    conversion_rate: r.conversion_rate ?? 0,
  }))

  const revData = salesRows.map((r) => ({
    monthLabel:    monthLabel(r.month),
    total_revenue: r.total_revenue ?? 0,
  }))

  const CHART_H = 280
  const MARGIN  = { top: 8, right: 8, left: 4, bottom: 0 }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

      {/* ── Conversão ao longo do tempo ────────────────── */}
      <div className="rounded-xl border border-border-default bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">
          Conversão ao longo do tempo
        </h3>
        <div ref={convRef} className="w-full">
          {isLoading ? <ChartSkeleton /> : convData.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-text-tertiary">
              Nenhum dado no período
            </div>
          ) : (
            <AreaChart
              width={convWidth}
              height={CHART_H}
              data={convData}
              margin={MARGIN}
            >
              <defs>
                <linearGradient id="gradConv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.conversion} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={C.conversion} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 11, fill: C.axis }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: C.axis }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}%`}
                width={38}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                formatter={(v: unknown) => [`${Number(v).toFixed(1)}%`, 'Conversão']}
              />
              <Area
                type="monotone"
                dataKey="conversion_rate"
                stroke={C.conversion}
                strokeWidth={2}
                fill="url(#gradConv)"
                dot={{ r: 3, fill: C.conversion, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          )}
        </div>
      </div>

      {/* ── Receita ao longo do tempo ──────────────────── */}
      <div className="rounded-xl border border-border-default bg-card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">
          Receita ao longo do tempo
        </h3>
        <div ref={revRef} className="w-full">
          {isLoading ? <ChartSkeleton /> : revData.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-text-tertiary">
              Nenhum dado no período
            </div>
          ) : (
            <BarChart
              width={revWidth}
              height={CHART_H}
              data={revData}
              margin={MARGIN}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} />
              <XAxis
                dataKey="monthLabel"
                tick={{ fontSize: 11, fill: C.axis }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: C.axis }}
                axisLine={false}
                tickLine={false}
                tickFormatter={fmtCurrencyCompact}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                formatter={(v: unknown) => [fmtCurrencyFull(Number(v)), 'Receita']}
              />
              <Bar
                dataKey="total_revenue"
                fill={C.revenue}
                radius={[4, 4, 0, 0]}
                opacity={0.85}
              />
            </BarChart>
          )}
        </div>
      </div>

    </div>
  )
}
