'use client'

import { useRef, useEffect, useState, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import {
  ClipboardList, CheckCircle2, Clock, AlertTriangle,
  TrendingUp, TrendingDown, Minus, ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/shared/page-header'
import { cn } from '@/lib/utils'
import {
  useMaintenanceDashboardStats,
  useMaintenanceTicketsTrend,
  useMaintenanceTicketsPeriod,
  type PeriodDays,
  type WeekBucket,
  type TicketSummary,
} from '@/hooks/use-maintenance-dashboard'
import { URGENCY_CONFIG, STATUS_CONFIG, NATURE_CONFIG } from '@/components/features/maintenance/ticket-card'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'

// ─────────────────────────────────────────────────────────────
// COLORS (hex for Recharts — cannot use CSS vars)
// ─────────────────────────────────────────────────────────────
const C = {
  brand:  '#7C8D78',
  green:  '#16A34A',
  amber:  '#D97706',
  red:    '#DC2626',
  muted:  '#94A3B8',
}

// ─────────────────────────────────────────────────────────────
// RESPONSIVE CHART WIDTH HOOK
// ─────────────────────────────────────────────────────────────
function useChartWidth(defaultWidth = 600) {
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

// ─────────────────────────────────────────────────────────────
// FORMAT DURATION
// ─────────────────────────────────────────────────────────────
function formatDuration(hours: number | null): string {
  if (hours === null) return '—'
  if (hours < 1) return `${Math.round(hours * 60)}min`
  if (hours < 24) return `${Math.round(hours)}h`
  const days = Math.floor(hours / 24)
  const rem  = Math.round(hours % 24)
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`
}

// ─────────────────────────────────────────────────────────────
// KPI CARD
// ─────────────────────────────────────────────────────────────
function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  color = 'text-foreground',
  isLoading,
  progress,
}: {
  icon:      React.ElementType
  label:     string
  value:     string | number
  sub?:      string
  trend?:    number | null
  color?:    string
  isLoading: boolean
  progress?: number
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
            <Icon className={cn('w-4 h-4', color)} />
          </div>
          <p className="text-sm font-medium text-text-secondary">{label}</p>
        </div>
        {trend !== undefined && trend !== null && (
          <span className={cn(
            'flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full',
            trend > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            : trend < 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            : 'bg-muted text-muted-foreground',
          )}>
            {trend > 0 ? <TrendingUp className="w-3 h-3" /> : trend < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="h-8 w-24 skeleton-shimmer rounded" />
      ) : (
        <p className={cn('text-3xl font-bold tabular-nums', color)}>{value}</p>
      )}
      {progress !== undefined && !isLoading && (
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      {sub && !isLoading && (
        <p className="text-xs text-text-tertiary">{sub}</p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PERIOD PILLS
// ─────────────────────────────────────────────────────────────
const PERIODS: { value: PeriodDays; label: string }[] = [
  { value: 30, label: 'Últimos 30d' },
  { value: 60, label: 'Últimos 60d' },
  { value: 90, label: 'Últimos 90d' },
]

// ─────────────────────────────────────────────────────────────
// RECENT TICKETS TABLE
// ─────────────────────────────────────────────────────────────
function RecentTicketsTable({ tickets, isLoading }: { tickets: TicketSummary[]; isLoading: boolean }) {
  const recent = tickets.slice(0, 10)

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Últimos chamados</h3>
        <Link
          href="/manutencao/chamados"
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Ver todos <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-3">
              <div className="h-4 w-1/2 skeleton-shimmer rounded" />
              <div className="h-5 w-16 skeleton-shimmer rounded-full ml-auto" />
            </div>
          ))}
        </div>
      ) : recent.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-text-tertiary">
          Nenhum chamado no período selecionado
        </div>
      ) : (
        <div className="divide-y divide-border">
          {recent.map((t) => {
            const urgency = URGENCY_CONFIG[t.urgency]
            const status  = STATUS_CONFIG[t.status]
            return (
              <Link
                key={t.id}
                href={`/manutencao/chamados/${t.id}`}
                className="flex items-center gap-3 px-5 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    {t.sector_name ?? 'Sem setor'} · {format(parseISO(t.created_at), 'dd/MM/yy', { locale: ptBR })}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {urgency && (
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', urgency.badge)}>
                      {urgency.label}
                    </span>
                  )}
                  {status && (
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border', status.badge)}>
                      {status.label}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function ManutencaoDashboardPage() {
  const [period, setPeriod] = useState<PeriodDays>(30)

  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: statsRefetch } =
    useMaintenanceDashboardStats()

  const { data: trendRaw, isLoading: trendLoading } =
    useMaintenanceTicketsTrend(period)
  const trend: WeekBucket[] = trendRaw ?? []

  const { data: periodRaw, isLoading: periodLoading } =
    useMaintenanceTicketsPeriod(period)
  const periodTickets: TicketSummary[] = periodRaw ?? []

  const isLoading = statsLoading || trendLoading || periodLoading
  const { isTimedOut, retry } = useLoadingTimeout(isLoading)

  // suppress unused warning for stats (available for future expansion)
  void stats

  // ── KPI calculations from period tickets ─────────────────
  // eslint-disable-next-line react-hooks/purity
  const nowTs = Date.now()
  const kpis = useMemo(() => {
    const now   = nowTs
    const total = periodTickets.length
    const concluded = periodTickets.filter((t) => t.status === 'concluded').length
    const resolutionRate = total > 0 ? Math.round((concluded / total) * 100) : 0

    const durations = periodTickets
      .filter((t) => t.status === 'concluded' && t.concluded_at)
      .map((t) => (new Date(t.concluded_at!).getTime() - new Date(t.created_at).getTime()) / 3_600_000)
      .filter((h) => h >= 0)

    const avgResolution = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : null

    const overdue = periodTickets.filter(
      (t) => t.due_at && t.status !== 'concluded' && t.status !== 'cancelled' && new Date(t.due_at).getTime() < now
    ).length

    return { total, resolutionRate, avgResolution, overdue }
  }, [periodTickets])

  // ── By-sector data ───────────────────────────────────────
  const bySector = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of periodTickets) {
      const name = t.sector_name ?? 'Sem setor'
      counts[name] = (counts[name] ?? 0) + 1
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)
  }, [periodTickets])

  // ── Chart refs ───────────────────────────────────────────
  const { ref: areaRef, width: areaWidth }     = useChartWidth()
  const { ref: sectorRef, width: sectorWidth } = useChartWidth()

  if (isTimedOut) {
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard de Manutenção" description="Visão gerencial de chamados e desempenho" />
        <div className="bg-card border border-destructive/30 rounded-xl p-8 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">O carregamento está demorando mais que o esperado.</p>
          <button onClick={retry} className="text-sm text-primary underline underline-offset-4">
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  if (statsError && !statsLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard de Manutenção" description="Visão gerencial de chamados e desempenho" />
        <div className="bg-card border border-destructive/30 rounded-xl p-8 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-destructive mx-auto" />
          <p className="text-sm text-muted-foreground">Erro ao carregar dados do dashboard.</p>
          <button onClick={() => statsRefetch()} className="text-sm text-primary underline underline-offset-4">
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <PageHeader
          title="Dashboard de Manutenção"
          description="Visão gerencial de chamados e desempenho"
        />
        {/* Period pills */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1 self-start sm:self-auto shrink-0">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                period === p.value
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={ClipboardList}
          label="Total no período"
          value={kpis.total}
          sub={`Últimos ${period} dias`}
          isLoading={periodLoading}
        />
        <KpiCard
          icon={CheckCircle2}
          label="Taxa de resolução"
          value={`${kpis.resolutionRate}%`}
          sub={`${periodTickets.filter(t => t.status === 'concluded').length} concluídos`}
          progress={kpis.resolutionRate}
          isLoading={periodLoading}
        />
        <KpiCard
          icon={Clock}
          label="Tempo médio"
          value={formatDuration(kpis.avgResolution)}
          sub="Para resolução completa"
          isLoading={periodLoading}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Em atraso"
          value={kpis.overdue}
          color={kpis.overdue > 0 ? 'text-red-500' : 'text-foreground'}
          sub="Com prazo vencido"
          isLoading={periodLoading}
        />
      </div>

      {/* ── Area Chart: weekly trend ─────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Chamados por semana</h3>
        <div ref={areaRef} className="w-full">
          {trendLoading ? (
            <div className="h-48 skeleton-shimmer rounded-lg" />
          ) : trend.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-text-tertiary">
              Nenhum dado no período
            </div>
          ) : (
            <AreaChart
              width={areaWidth}
              height={200}
              data={trend}
              margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="mgBrand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.brand} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.brand} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="mgGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.green} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.green} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                formatter={(v, name) => [v, name === 'open' ? 'Abertos' : 'Concluídos']}
                labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
              />
              <Legend formatter={(v) => v === 'open' ? 'Abertos' : 'Concluídos'} wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="open"      stroke={C.brand} fill="url(#mgBrand)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="concluded" stroke={C.green} fill="url(#mgGreen)" strokeWidth={2} dot={false} />
            </AreaChart>
          )}
        </div>
      </div>

      {/* ── Distribution: by sector + by nature ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* By Sector */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Por setor</h3>
          <div ref={sectorRef} className="w-full">
            {periodLoading ? (
              <div className="h-48 skeleton-shimmer rounded-lg" />
            ) : bySector.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-text-tertiary">
                Nenhum dado no período
              </div>
            ) : (
              <BarChart
                width={sectorWidth}
                height={Math.max(160, bySector.length * 32 + 40)}
                data={bySector}
                layout="vertical"
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ fontSize: 11, fill: '#94A3B8' }}
                  tickFormatter={(v: string) => v.length > 12 ? v.slice(0, 12) + '...' : v}
                />
                <Tooltip
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [v, 'Chamados']}
                />
                <Bar dataKey="count" fill={C.brand} radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            )}
          </div>
        </div>

        {/* By Nature */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Por natureza</h3>
          {periodLoading ? (
            <div className="h-48 skeleton-shimmer rounded-lg" />
          ) : periodTickets.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-sm text-text-tertiary">
              Nenhum dado no período
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              {(Object.entries(
                periodTickets.reduce<Record<string, number>>((acc, t) => {
                  acc[t.nature] = (acc[t.nature] ?? 0) + 1
                  return acc
                }, {})
              ) as [string, number][])
                .sort(([, a], [, b]) => b - a)
                .map(([nature, count]) => {
                  const cfg   = NATURE_CONFIG[nature]
                  const pct   = periodTickets.length > 0 ? Math.round((count / periodTickets.length) * 100) : 0
                  return (
                    <div key={nature} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className={cn('font-medium px-2 py-0.5 rounded-full border text-xs', cfg?.badge)}>
                          {cfg?.label ?? nature}
                        </span>
                        <span className="text-text-secondary tabular-nums">{count} · {pct}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: C.brand }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Tickets ───────────────────────────────── */}
      <RecentTicketsTable tickets={periodTickets} isLoading={periodLoading} />
    </div>
  )
}
