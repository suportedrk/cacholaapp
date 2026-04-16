'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ChevronLeft, ChevronRight, ExternalLink, Search, Loader2,
  Calendar, TrendingUp, Banknote, BarChart3, Clock,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer,
} from 'recharts'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { DrilldownDealCard } from './drilldown-deal-card'
import { cn } from '@/lib/utils'
import { useBISellerHistory } from '@/hooks/use-bi-seller-history'
import { useBISellerFunnel } from '@/hooks/use-bi-seller-funnel'
import { useBISellerDeals } from '@/hooks/use-bi-seller-deals'
import { useBISellerEvents } from '@/hooks/use-bi-seller-events'
import type { SellerRankingRow } from '@/hooks/use-bi-sellers-ranking'

// ── Constants ─────────────────────────────────────────────────

const PAGE_SIZE = 20

const STATUS_FILTERS = [
  { label: 'Todos',     value: null },
  { label: 'Em aberto', value: 1 },
  { label: 'Ganhos',    value: 2 },
  { label: 'Perdidos',  value: 3 },
] as const

// ── Helpers ───────────────────────────────────────────────────

function formatCurrency(v: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
  }).format(v)
}

function formatCurrencyCompact(v: number): string {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$${(v / 1_000).toFixed(1)}k`
  return formatCurrency(v)
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const AVATAR_COLORS = [
  'bg-primary', 'bg-blue-500', 'bg-violet-500', 'bg-amber-600',
  'bg-rose-500', 'bg-teal-600', 'bg-orange-500', 'bg-indigo-500',
]
function getAvatarColor(name: string): string {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function useDebounce(value: string, delay: number): string {
  const [d, setD] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setD(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return d
}

function formatMonthShort(yyyyMM: string): string {
  const [year, month] = yyyyMM.split('-')
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
}

// ── KPI card mini ─────────────────────────────────────────────

function MiniKpi({ label, value, icon: Icon, className }: {
  label: string; value: string; icon: React.ElementType; className?: string
}) {
  return (
    <div className={cn('rounded-lg border border-border-default bg-surface-secondary p-3', className)}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
        <p className="text-[11px] text-text-tertiary">{label}</p>
      </div>
      <p className="text-base font-bold text-text-primary">{value}</p>
    </div>
  )
}

// ── Funnel bucket ─────────────────────────────────────────────

const BUCKET_CONFIG = {
  em_aberto: { label: 'Em aberto', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800' },
  ganhos:    { label: 'Ganhos',    bg: 'bg-green-100 dark:bg-green-900/30',  text: 'text-green-700 dark:text-green-400',  border: 'border-green-200 dark:border-green-800'  },
  perdidos:  { label: 'Perdidos',  bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-600 dark:text-neutral-400', border: 'border-neutral-200 dark:border-neutral-700' },
} as const

// ── Props ─────────────────────────────────────────────────────

interface Props {
  isOpen: boolean
  onClose: () => void
  seller: SellerRankingRow | null
  unitId: string | null
  periodMonths: number
}

// ── Component ─────────────────────────────────────────────────

export function SellerDrilldownSheet({ isOpen, onClose, seller, unitId, periodMonths }: Props) {
  const ownerName = seller?.owner_name ?? null

  // Tab deals state
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<number | null>(null)
  const [page,         setPage]         = useState(0)
  const debouncedSearch = useDebounce(search, 300)

  /* eslint-disable react-hooks/set-state-in-effect */
  // Reset on open / seller change
  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setStatusFilter(null)
      setPage(0)
    }
  }, [isOpen, ownerName])

  useEffect(() => { setPage(0) }, [debouncedSearch, statusFilter])
  /* eslint-enable react-hooks/set-state-in-effect */

  const history = useBISellerHistory(ownerName, unitId, periodMonths)
  const funnel  = useBISellerFunnel(ownerName, unitId, periodMonths)
  const deals   = useBISellerDeals({
    ownerName: isOpen ? ownerName : null,
    unitId,
    statusFilter,
    search: debouncedSearch,
    page,
    pageSize: PAGE_SIZE,
  })
  const events = useBISellerEvents(isOpen ? ownerName : null, unitId)

  const totalCount = deals.data?.totalCount ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const fromItem   = totalCount === 0 ? 0 : page * PAGE_SIZE + 1
  const toItem     = Math.min((page + 1) * PAGE_SIZE, totalCount)

  const handlePrev = useCallback(() => setPage((p) => Math.max(0, p - 1)), [])
  const handleNext = useCallback(() => setPage((p) => Math.min(totalPages - 1, p + 1)), [totalPages])

  if (!seller) return null

  const initials    = getInitials(seller.owner_name)
  const avatarColor = getAvatarColor(seller.owner_name)

  // History chart data
  const historyRows = history.data ?? []

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent
        side="right"
        showCloseButton
        className="w-full sm:max-w-xl flex flex-col gap-0 p-0"
      >
        {/* ── Header com avatar + nome ── */}
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border-default shrink-0">
          <div className="flex items-center gap-3 pr-8">
            <div className={cn(
              'w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-sm font-bold text-white',
              avatarColor,
            )}>
              {initials}
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-base font-semibold text-text-primary truncate">
                {seller.owner_name}
              </SheetTitle>
              <p className="text-xs text-text-tertiary mt-0.5">
                {periodMonths}M · {seller.leads_count} leads
              </p>
            </div>
          </div>
        </SheetHeader>

        {/* ── 4 KPI cards mini ── */}
        <div className="px-4 py-3 grid grid-cols-2 gap-2 shrink-0 border-b border-border-default">
          <MiniKpi
            label="Leads"
            value={seller.leads_count.toString()}
            icon={BarChart3}
          />
          <MiniKpi
            label="Ganhos"
            value={seller.won_count.toString()}
            icon={TrendingUp}
          />
          <MiniKpi
            label="Conversão"
            value={`${seller.conversion_rate.toFixed(1)}%`}
            icon={TrendingUp}
          />
          <MiniKpi
            label="Receita"
            value={formatCurrencyCompact(seller.total_revenue)}
            icon={Banknote}
          />
        </div>

        {/* Extras */}
        <div className="px-4 py-2 flex items-center gap-4 text-xs text-text-tertiary border-b border-border-default shrink-0">
          <span>
            <Clock className="w-3.5 h-3.5 inline mr-1" />
            Tempo médio:{' '}
            {seller.won_count > 0 ? (
              <span className="text-text-secondary font-medium">
                {/* avg_days_to_close está no history, mostramos do último mês */}
                {historyRows.length > 0 && historyRows[historyRows.length - 1]?.avg_days_to_close != null
                  ? `${Math.round(historyRows[historyRows.length - 1].avg_days_to_close!)} dias`
                  : '—'}
              </span>
            ) : '—'}
          </span>
          <span>
            Em aberto:{' '}
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              {seller.open_count}
            </span>
          </span>
        </div>

        {/* ── 4 Tabs ── */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          <Tabs defaultValue="historico" className="flex-1 overflow-hidden flex flex-col gap-0">
            {/* Tab list */}
            <div className="px-4 pt-2 pb-0 border-b border-border-default shrink-0">
              <TabsList variant="default" className="w-full justify-start gap-1 bg-transparent p-0 border-0">
                <TabsTrigger value="historico">Histórico</TabsTrigger>
                <TabsTrigger value="funil">Funil</TabsTrigger>
                <TabsTrigger value="deals">Deals</TabsTrigger>
                <TabsTrigger value="eventos">Eventos</TabsTrigger>
              </TabsList>
            </div>

            {/* ── Tab: Histórico ── */}
            <TabsContent value="historico" className="flex-1 overflow-y-auto px-4 py-4 mt-0">
              {history.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-48 w-full skeleton-shimmer" />
                </div>
              ) : historyRows.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-sm text-text-secondary">
                  Sem dados no período selecionado.
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Area chart: receita mensal */}
                  <div>
                    <p className="text-xs text-text-tertiary mb-2">Receita mensal (R$)</p>
                    <div style={{ height: 160 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={historyRows} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id="sellRevGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor="#7C8D78" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#7C8D78" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis
                            dataKey="month_label"
                            tickFormatter={formatMonthShort}
                            tick={{ fontSize: 11, fill: '#94A3B8' }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            tickFormatter={(v: number) => formatCurrencyCompact(v)}
                            tick={{ fontSize: 11, fill: '#94A3B8' }}
                            tickLine={false}
                            axisLine={false}
                            width={52}
                          />
                          <Tooltip
                            contentStyle={{
                              background: 'var(--card)',
                              border: '1px solid var(--border)',
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            formatter={(v: any) => [formatCurrency(v as number), 'Receita']}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            labelFormatter={(label: any) => formatMonthShort(label as string)}
                          />
                          <Area
                            type="monotone"
                            dataKey="revenue"
                            stroke="#7C8D78"
                            strokeWidth={2}
                            fill="url(#sellRevGrad)"
                            dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Monthly table */}
                  <div className="rounded-lg border border-border-default overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-surface-secondary border-b border-border-default">
                          <th className="px-3 py-2 text-left text-text-secondary font-medium">Mês</th>
                          <th className="px-3 py-2 text-right text-text-secondary font-medium">Leads</th>
                          <th className="px-3 py-2 text-right text-text-secondary font-medium">Ganhos</th>
                          <th className="px-3 py-2 text-right text-text-secondary font-medium">Receita</th>
                          <th className="px-3 py-2 text-right text-text-secondary font-medium">Fech.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...historyRows].reverse().map((r) => (
                          <tr key={r.month_label} className="border-b border-border-default last:border-0">
                            <td className="px-3 py-2 text-text-secondary">{formatMonthShort(r.month_label)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{r.leads_count}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{r.won_count}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-text-secondary">{formatCurrencyCompact(r.revenue)}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-text-tertiary">
                              {r.avg_days_to_close != null ? `${Math.round(r.avg_days_to_close)}d` : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── Tab: Funil ── */}
            <TabsContent value="funil" className="flex-1 overflow-y-auto px-4 py-4 mt-0">
              {funnel.isLoading ? (
                <div className="grid grid-cols-3 gap-3">
                  {[1,2,3].map((i) => <Skeleton key={i} className="h-24 skeleton-shimmer" />)}
                </div>
              ) : (funnel.data?.length ?? 0) === 0 ? (
                <div className="flex items-center justify-center py-12 text-sm text-text-secondary">
                  Sem dados no período.
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {(['em_aberto', 'ganhos', 'perdidos'] as const).map((key) => {
                    const bucket = funnel.data?.find((b) => b.bucket === key)
                    const cfg    = BUCKET_CONFIG[key]
                    return (
                      <div
                        key={key}
                        className={cn(
                          'rounded-xl border p-3 text-center',
                          cfg.bg, cfg.border,
                        )}
                      >
                        <p className={cn('text-xs font-medium mb-1', cfg.text)}>{cfg.label}</p>
                        <p className={cn('text-xl font-bold', cfg.text)}>
                          {bucket?.deals_count ?? 0}
                        </p>
                        <p className={cn('text-[11px] mt-0.5', cfg.text, 'opacity-70')}>
                          {bucket ? formatCurrencyCompact(bucket.total_value) : '—'}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </TabsContent>

            {/* ── Tab: Deals ── */}
            <TabsContent value="deals" className="flex-1 overflow-hidden flex flex-col mt-0">
              {/* Filters */}
              <div className="px-4 pt-3 pb-2 space-y-2 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nome..."
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border-default bg-surface-secondary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-border-focus"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_FILTERS.map((f) => (
                    <button
                      key={String(f.value)}
                      onClick={() => setStatusFilter(f.value)}
                      className={
                        statusFilter === f.value
                          ? 'px-3 py-1 rounded-full text-xs font-semibold bg-primary text-primary-foreground transition-colors'
                          : 'px-3 py-1 rounded-full text-xs font-semibold bg-surface-tertiary text-text-secondary hover:bg-surface-secondary border border-border-default transition-colors'
                      }
                    >
                      {f.label}
                    </button>
                  ))}
                  {deals.isFetching && !deals.isLoading && (
                    <Loader2 className="w-4 h-4 text-text-tertiary animate-spin self-center ml-1" />
                  )}
                </div>
              </div>

              {/* Deal list */}
              <div className="flex-1 overflow-y-auto px-4 py-1 space-y-2">
                {deals.isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="rounded-lg border border-border-default bg-surface-secondary p-3 space-y-2">
                      <Skeleton className="h-4 w-48 skeleton-shimmer" />
                      <Skeleton className="h-3 w-32 skeleton-shimmer" />
                      <Skeleton className="h-3 w-40 skeleton-shimmer" />
                    </div>
                  ))
                ) : (deals.data?.deals.length ?? 0) === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                    <Search className="w-6 h-6 text-text-tertiary" />
                    <p className="text-sm text-text-secondary">
                      {debouncedSearch || statusFilter != null
                        ? 'Nenhum deal para os filtros aplicados.'
                        : 'Nenhum deal encontrado.'}
                    </p>
                  </div>
                ) : (
                  deals.data!.deals.map((deal) => (
                    <DrilldownDealCard key={deal.id} deal={deal} />
                  ))
                )}
              </div>

              {/* Pagination */}
              {!deals.isLoading && totalCount > 0 && (
                <div className="shrink-0 border-t border-border-default px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-text-tertiary">
                    {fromItem}–{toItem} de {totalCount.toLocaleString('pt-BR')}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={handlePrev} disabled={page === 0} className="h-7 px-2">
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-xs text-text-secondary px-2 tabular-nums">
                      {page + 1} / {totalPages}
                    </span>
                    <Button variant="outline" size="sm" onClick={handleNext} disabled={page >= totalPages - 1} className="h-7 px-2">
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── Tab: Eventos ── */}
            <TabsContent value="eventos" className="flex-1 overflow-y-auto px-4 py-3 mt-0">
              {events.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full skeleton-shimmer" />
                  ))}
                </div>
              ) : (events.data?.length ?? 0) === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                  <Calendar className="w-7 h-7 text-text-tertiary" />
                  <p className="text-sm text-text-secondary">
                    Nenhum evento confirmado atribuído a esta vendedora no período.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {events.data!.map((ev) => {
                    const eventTitle = ev.birthday_person
                      ? `${ev.birthday_person}${ev.birthday_age ? ` · ${ev.birthday_age} anos` : ''}`
                      : ev.title
                    const dateLabel = format(parseISO(`${ev.date}T00:00:00`), "dd 'de' MMM yyyy", { locale: ptBR })
                    return (
                      <Link
                        key={ev.id}
                        href={`/eventos/${ev.id}`}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border-default hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{eventTitle}</p>
                          {ev.client_name && (
                            <p className="text-xs text-text-tertiary truncate">{ev.client_name}</p>
                          )}
                          <p className="text-xs text-text-secondary mt-0.5">
                            {dateLabel} · {ev.start_time.slice(0, 5)}–{ev.end_time.slice(0, 5)}
                          </p>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                      </Link>
                    )
                  })}
                </div>
              )}
            </TabsContent>

          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
