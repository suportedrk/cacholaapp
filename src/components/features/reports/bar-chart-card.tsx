'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type BarSeries = {
  dataKey: string
  name:    string
  color:   string
  stackId?: string
}

type BarChartCardProps = {
  title:    string
  data:     Record<string, string | number>[]
  series:   BarSeries[]
  xKey:     string
  loading?: boolean
  height?:  number
  className?: string
  stacked?: boolean
}

// ─────────────────────────────────────────────────────────────
// TOOLTIP CUSTOMIZADO
// ─────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
  label?:   string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-foreground">
            {p.value.toLocaleString('pt-BR')}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE
// ─────────────────────────────────────────────────────────────

export function BarChartCard({
  title, data, series, xKey,
  loading, height = 260, className, stacked,
}: BarChartCardProps) {
  return (
    <div className={cn('rounded-xl border bg-card p-5', className)}>
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>

      {loading ? (
        <div className="animate-pulse bg-muted rounded" style={{ height }} />
      ) : data.length === 0 ? (
        <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>
          Nenhum dado no período
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height} debounce={50}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
            {series.length > 1 && (
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                iconSize={8}
                iconType="circle"
              />
            )}
            {series.map((s) => (
              <Bar
                key={s.dataKey}
                dataKey={s.dataKey}
                name={s.name}
                fill={s.color}
                stackId={stacked ? (s.stackId ?? 'stack') : undefined}
                radius={stacked ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                maxBarSize={40}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
