'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { CHART_COLORS } from '@/lib/constants/brand-colors'

type DataItem = { name: string; value: number }

type HorizontalBarChartCardProps = {
  title:    string
  data:     DataItem[]
  color?:   string
  loading?: boolean
  height?:  number
  className?: string
  maxItems?: number
}

function CustomTooltip({ active, payload }: {
  active?: boolean
  payload?: { name: string; value: number; color: string }[]
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-card border rounded-lg shadow-lg px-3 py-2 text-sm">
      <span className="text-muted-foreground mr-2">Total:</span>
      <span className="font-semibold text-foreground">
        {payload[0].value.toLocaleString('pt-BR')}
      </span>
    </div>
  )
}

export function HorizontalBarChartCard({
  title, data, color = CHART_COLORS.primary,
  loading, height, className, maxItems = 10,
}: HorizontalBarChartCardProps) {
  const sliced  = data.slice(0, maxItems)
  const calcH   = height ?? Math.max(180, sliced.length * 36 + 40)

  return (
    <div className={cn('rounded-xl border bg-card p-5', className)}>
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>

      {loading ? (
        <div className="animate-pulse bg-muted rounded" style={{ height: calcH }} />
      ) : sliced.length === 0 ? (
        <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height: calcH }}>
          Nenhum dado no período
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={calcH}>
          <BarChart
            data={sliced}
            layout="vertical"
            margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + '…' : v}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
            <Bar
              dataKey="value"
              fill={color}
              radius={[0, 4, 4, 0]}
              maxBarSize={24}
              animationBegin={0}
              animationDuration={500}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
