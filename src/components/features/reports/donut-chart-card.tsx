'use client'

import {
  PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { cn } from '@/lib/utils'

// Paleta baseada na cor primária (#7C8D78) + variações
export const CHART_COLORS = [
  '#7C8D78', // verde sálvia primário
  '#B5C4B1', // sálvia claro
  '#4A5E46', // sálvia escuro
  '#E3DAD1', // bege quente
  '#C4B5A0', // bege médio
  '#9C8B78', // bege escuro
  '#6B9E8B', // verde-água
  '#A8C5BD', // verde-água claro
]

type DonutItem = { name: string; value: number }

type DonutChartCardProps = {
  title:    string
  data:     DonutItem[]
  loading?: boolean
  height?:  number
  className?: string
}

function CustomTooltip({ active, payload }: {
  active?: boolean
  payload?: { name: string; value: number; payload: { name: string; value: number } }[]
}) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="bg-card border rounded-lg shadow-lg px-3 py-2 text-sm">
      <p className="font-medium text-foreground">{item.name}</p>
      <p className="text-muted-foreground">
        {item.value.toLocaleString('pt-BR')} itens
      </p>
    </div>
  )
}

function CustomLabel({ cx, cy, total }: { cx: number; cy: number; total: number }) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
      <tspan x={cx} dy="-0.3em" className="text-2xl font-bold" style={{ fontSize: 22, fontWeight: 700, fill: 'hsl(var(--foreground))' }}>
        {total.toLocaleString('pt-BR')}
      </tspan>
      <tspan x={cx} dy="1.4em" style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}>
        total
      </tspan>
    </text>
  )
}

export function DonutChartCard({
  title, data, loading, height = 260, className,
}: DonutChartCardProps) {
  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className={cn('rounded-xl border bg-card p-5', className)}>
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>

      {loading ? (
        <div className="animate-pulse bg-muted rounded-full mx-auto" style={{ height, width: height }} />
      ) : data.length === 0 || total === 0 ? (
        <div className="flex items-center justify-center text-muted-foreground text-sm" style={{ height }}>
          Nenhum dado no período
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              innerRadius="55%"
              outerRadius="75%"
              paddingAngle={2}
              dataKey="value"
              animationBegin={0}
              animationDuration={600}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="none" />
              ))}
              {/* Label central */}
              <text x="50%" y="45%" textAnchor="middle" dominantBaseline="central">
                <tspan x="50%" dy="-0.3em" style={{ fontSize: 22, fontWeight: 700, fill: 'hsl(var(--foreground))' }}>
                  {total.toLocaleString('pt-BR')}
                </tspan>
                <tspan x="50%" dy="1.4em" style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}>
                  total
                </tspan>
              </text>
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconSize={8}
              iconType="circle"
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              formatter={(value) => (
                <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// Re-export label helper for use in other components
export { CustomLabel }
