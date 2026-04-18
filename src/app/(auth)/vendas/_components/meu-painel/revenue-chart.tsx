'use client'

import { useRef, useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import type { VendasDailyRevenue } from '@/hooks/use-vendas'

// ── Colors ────────────────────────────────────────────────────
const C = {
  revenue: '#7C8D78',
  grid:    'rgba(148,163,184,0.15)',
  axis:    '#94A3B8',
}

// ── Chart width hook ──────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try { return format(parseISO(iso), 'd/MM', { locale: ptBR }) }
  catch { return iso }
}

function fmtCurrencyCompact(v: number): string {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$${(v / 1_000).toFixed(0)}k`
  return `R$${v.toFixed(0)}`
}

function fmtCurrencyFull(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
  }).format(v)
}

// ── Component ─────────────────────────────────────────────────

interface Props {
  rows:      VendasDailyRevenue[]
  isLoading: boolean
}

export function RevenueChart({ rows, isLoading }: Props) {
  const { ref, width } = useChartWidth()

  if (isLoading) {
    return <Skeleton className="skeleton-shimmer w-full h-[220px] rounded-xl" />
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] rounded-xl border border-border-default bg-card text-text-tertiary text-sm">
        Sem orders no período
      </div>
    )
  }

  const data = rows.map((r) => ({
    date:       r.order_date,
    dateLabel:  fmtDate(r.order_date),
    revenue:    r.revenue,
    cumulative: r.cumulative_revenue,
  }))

  return (
    <div className="bg-card rounded-xl border border-border-default p-4">
      <p className="text-xs font-medium text-text-secondary mb-3">Receita acumulada</p>
      <div ref={ref} className="w-full">
        <AreaChart
          width={width}
          height={180}
          data={data}
          margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.revenue} stopOpacity={0.25} />
              <stop offset="95%" stopColor={C.revenue} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
          <XAxis
            dataKey="dateLabel"
            tick={{ fill: C.axis, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={fmtCurrencyCompact}
            tick={{ fill: C.axis, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={52}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(label) => label}
            formatter={(value, name) => [
              fmtCurrencyFull(Number(value ?? 0)),
              name === 'cumulative' ? 'Acumulado' : 'No dia',
            ]}
          />
          <Area
            type="monotone"
            dataKey="cumulative"
            stroke={C.revenue}
            strokeWidth={2}
            fill="url(#revenueGrad)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </div>
    </div>
  )
}
