// NOTA: internamente usa "seller/sellers" por motivos históricos, mas a UI exibe
// "Responsável por Deal" pois o campo reflete OwnerId do Ploomes (atendimento ao
// cliente), não vendedor individual por produto/serviço.

'use client'

import { useMemo, useRef, useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import type { SellerRankingRow } from '@/hooks/use-bi-sellers-ranking'

// ── Helpers ───────────────────────────────────────────────────

function formatCurrencyCompact(v: number): string {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$${(v / 1_000).toFixed(0)}k`
  return `R$${v.toFixed(0)}`
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/)
  return parts[0]
}

// Reaproveia useChartWidth para responsividade sem ResizeObserver issues
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
  rows: SellerRankingRow[]
}

// ── Component ─────────────────────────────────────────────────

export function SellersCharts({ rows }: Props) {
  const revenueRef    = useRef<HTMLDivElement>(null)
  const conversionRef = useRef<HTMLDivElement>(null)
  const revenueWidth    = useChartWidth(revenueRef)
  const conversionWidth = useChartWidth(conversionRef)

  // Sort by revenue desc, take top 8 to avoid overcrowding
  const revenueData = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.total_revenue - a.total_revenue)
        .slice(0, 8)
        .map((r) => ({ name: shortName(r.owner_name), value: r.total_revenue, full: r.owner_name })),
    [rows],
  )

  const conversionData = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.conversion_rate - a.conversion_rate)
        .slice(0, 8)
        .map((r) => ({ name: shortName(r.owner_name), value: r.conversion_rate, full: r.owner_name })),
    [rows],
  )

  if (rows.length === 0) return null

  const BAR_H = 36
  const revenueHeight    = Math.max(180, revenueData.length * BAR_H + 32)
  const conversionHeight = Math.max(180, conversionData.length * BAR_H + 32)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

      {/* Receita por Vendedora */}
      <div className="rounded-xl border border-border-default bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border-default">
          <h3 className="text-sm font-semibold text-text-primary">Receita por Responsável</h3>
          <p className="text-xs text-text-secondary mt-0.5">Deals ganhos no período</p>
        </div>
        <div className="p-4">
          <div ref={revenueRef} style={{ height: revenueHeight }}>
            <BarChart
              width={revenueWidth}
              height={revenueHeight}
              data={revenueData}
              layout="vertical"
              margin={{ top: 0, right: 56, bottom: 0, left: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={72}
                tick={{ fontSize: 12, fill: '#94A3B8' }}
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
                  formatCurrencyCompact(value as number),
                  entry.payload.full,
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
                {revenueData.map((_, i) => (
                  <Cell key={i} fill="#7C8D78" fillOpacity={1 - i * 0.07} />
                ))}
              </Bar>
            </BarChart>
          </div>
        </div>
      </div>

      {/* Conversão por Vendedora */}
      <div className="rounded-xl border border-border-default bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border-default">
          <h3 className="text-sm font-semibold text-text-primary">Conversão por Responsável</h3>
          <p className="text-xs text-text-secondary mt-0.5">Taxa de leads ganhos (%)</p>
        </div>
        <div className="p-4">
          <div ref={conversionRef} style={{ height: conversionHeight }}>
            <BarChart
              width={conversionWidth}
              height={conversionHeight}
              data={conversionData}
              layout="vertical"
              margin={{ top: 0, right: 56, bottom: 0, left: 0 }}
            >
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis
                type="category"
                dataKey="name"
                width={72}
                tick={{ fontSize: 12, fill: '#94A3B8' }}
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
                  `${(value as number).toFixed(1)}%`,
                  entry.payload.full,
                ]}
                labelFormatter={() => ''}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{
                position: 'right',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter: (v: any) => `${(v as number).toFixed(1)}%`,
                fontSize: 11,
                fill: '#94A3B8',
              }}>
                {conversionData.map((_, i) => (
                  <Cell key={i} fill="#22c55e" fillOpacity={1 - i * 0.07} />
                ))}
              </Bar>
            </BarChart>
          </div>
        </div>
      </div>

    </div>
  )
}
