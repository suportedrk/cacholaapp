'use client'

import { Suspense, useState, useCallback, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { SearchX, PartyPopper, CalendarX, Loader2, AlertTriangle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { FilterChip } from '@/components/shared/filter-chip'
import { EventCard, EventCardSkeleton } from '@/components/features/events/event-card'
import { EventTemporalTabs } from '@/components/features/events/event-temporal-tabs'
import { EventDayGroup } from '@/components/features/events/event-day-group'
import { EventsKpiCards } from '@/components/features/events/events-kpi-cards'
import { useEventsInfinite, useEventsTabCounts, useEventsKpis, useEventsByIds, type TabKey } from '@/hooks/use-events'
import {
  useEventConflicts,
  useOverlappingEventIds,
  useShortGapEventIds,
} from '@/hooks/use-event-conflicts'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { usePloomesIntegrationActive } from '@/hooks/use-ploomes-sync'
import { useUnitStore } from '@/stores/unit-store'
import { useDebounce } from '@/hooks/use-debounce'
import { STATUS_CONFIG } from '@/components/shared/event-status-badge'
import type { EventStatus } from '@/types/database.types'
import type { FilterChipColor } from '@/components/shared/filter-chip'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────
type ConflictFilter = 'overlap' | 'short_gap'
type ActiveFilter   = EventStatus | ConflictFilter | null

// ─────────────────────────────────────────────────────────────
// Configuração de chips de status
// ─────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<EventStatus, FilterChipColor> = {
  pending:     'amber',
  confirmed:   'blue',
  preparing:   'purple',
  in_progress: 'brand',
  finished:    'gray',
  post_event:  'gray',
  lost:        'gray',
}

const MAIN_STATUSES: EventStatus[] = ['confirmed']

// ─────────────────────────────────────────────────────────────
// Helper: agrupa eventos por data
// ─────────────────────────────────────────────────────────────
function groupEventsByDate<T extends { date: string }>(events: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const ev of events) {
    const existing = map.get(ev.date)
    if (existing) {
      existing.push(ev)
    } else {
      map.set(ev.date, [ev])
    }
  }
  return map
}

// ─────────────────────────────────────────────────────────────
// Skeleton da listagem (para Suspense fallback)
// ─────────────────────────────────────────────────────────────
function EventListSkeleton() {
  return (
    <div className="space-y-4">
      {/* Tabs skeleton */}
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {[80, 76, 52, 64].map((w, i) => (
          <div key={i} className={cn('h-8 rounded-full skeleton-shimmer shrink-0')} style={{ width: w }} />
        ))}
      </div>
      {/* Search skeleton */}
      <div className="h-10 rounded-lg skeleton-shimmer" />
      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <EventCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Conteúdo principal — usa useSearchParams
// ─────────────────────────────────────────────────────────────
function EventosContent() {
  const router   = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeUnitId = useUnitStore((s) => s.activeUnitId)

  // Aba ativa (persistida na URL)
  const tab = (searchParams.get('tab') as TabKey) ?? 'all'

  // Filtro ativo (status OU tipo de conflito — mutuamente exclusivos)
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(null)
  const [searchInput, setSearchInput]   = useState('')
  const debouncedSearch = useDebounce(searchInput, 300)

  const { data: ploomesActive } = usePloomesIntegrationActive(activeUnitId)
  const { data: tabCounts, isLoading: countsLoading } = useEventsTabCounts()
  const { data: kpis, isLoading: kpisLoading } = useEventsKpis()

  // Conflitos de horário
  const { isLoading: conflictsLoading } = useEventConflicts()
  const overlappingIds = useOverlappingEventIds()
  const shortGapIds    = useShortGapEventIds()

  // Se o filtro ativo é de conflito, buscar os eventos por ID (servidor)
  const isConflictFilter = activeFilter === 'overlap' || activeFilter === 'short_gap'

  // IDs a buscar quando filtro de conflito ativo (array ordenado = queryKey estável)
  const conflictEventIds = useMemo(() => {
    if (activeFilter === 'overlap')   return Array.from(overlappingIds).sort()
    if (activeFilter === 'short_gap') return Array.from(shortGapIds).sort()
    return []
  }, [activeFilter, overlappingIds, shortGapIds])

  // Query específica para filtros de conflito (sem paginação)
  const {
    data:      conflictEventsData,
    isLoading: conflictEventsLoading,
    isError:   conflictEventsError,
  } = useEventsByIds(conflictEventIds)

  // Status para a query de listagem normal
  const queryStatus: EventStatus[] | undefined = useMemo(() => {
    if (!activeFilter || isConflictFilter) return undefined
    return [activeFilter as EventStatus]
  }, [activeFilter, isConflictFilter])

  const {
    data,
    isLoading:         listLoading,
    isError:           listError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useEventsInfinite({
    tab,
    status: queryStatus,
    search: debouncedSearch || undefined,
  })

  // Unifica loading/error dependendo do modo ativo
  const isLoading = isConflictFilter
    ? (conflictsLoading || conflictEventsLoading)
    : listLoading
  const isError = isConflictFilter ? conflictEventsError : listError

  const { isTimedOut, retry } = useLoadingTimeout(isLoading)

  // Eventos a exibir: por IDs (conflito) ou paginado (normal)
  const allEvents = useMemo(
    () => data?.pages.flatMap((p) => p.events) ?? [],
    [data]
  )
  const total = data?.pages[0]?.total ?? 0

  const displayEvents = useMemo(
    () => isConflictFilter ? (conflictEventsData ?? []) : allEvents,
    [isConflictFilter, conflictEventsData, allEvents]
  )

  const grouped = useMemo(() => groupEventsByDate(displayEvents), [displayEvents])

  // Troca de aba: atualiza URL, limpa filtros
  const handleTabChange = useCallback((newTab: TabKey) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', newTab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    setActiveFilter(null)
  }, [searchParams, pathname, router])

  // Toggle de filtro — exclusivo (click no ativo limpa, click em outro troca)
  const toggleFilter = useCallback((value: ActiveFilter) => {
    setActiveFilter((prev) => prev === value ? null : value)
  }, [])

  const hasSearch  = debouncedSearch.trim().length > 0
  const hasFilter  = activeFilter !== null

  if (isTimedOut) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-text-secondary text-sm">O carregamento está demorando mais que o esperado.</p>
        <button onClick={retry} className="text-sm text-primary underline underline-offset-4">
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <EventsKpiCards
        tabCounts={tabCounts}
        checklistPct={kpis?.checklistPct}
        pendingCount={kpis?.pendingCount}
        isLoading={kpisLoading || countsLoading}
        onTabChange={handleTabChange}
      />

      {/* Abas temporais */}
      <EventTemporalTabs
        active={tab}
        counts={tabCounts}
        isLoading={countsLoading}
        onTabChange={handleTabChange}
      />

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar por aniversariante, contratante, tema..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchInput && (
          <button
            aria-label="Limpar busca"
            onClick={() => setSearchInput('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Chips de filtro */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Chips de status */}
        {MAIN_STATUSES.map((status) => (
          <FilterChip
            key={status}
            label={STATUS_CONFIG[status].label}
            active={activeFilter === status}
            color={STATUS_COLOR[status]}
            onClick={() => toggleFilter(status)}
          />
        ))}

        {/* Separador + "Perdido" */}
        <span className="w-px h-5 bg-border self-center mx-0.5" />
        <FilterChip
          label="Perdido"
          active={activeFilter === 'lost'}
          color="gray"
          onClick={() => toggleFilter('lost')}
        />

        {/* Separador + chips de conflito */}
        <span className="w-px h-5 bg-border self-center mx-0.5" />

        {/* Chip: Sobreposição de horário */}
        <button
          onClick={() => toggleFilter('overlap')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors',
            activeFilter === 'overlap'
              ? 'border-red-300 bg-red-100 text-red-700 dark:border-red-700 dark:bg-red-900/40 dark:text-red-400'
              : 'border-border bg-background text-muted-foreground hover:bg-muted'
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Conflito de horário
          {overlappingIds.size > 0 && (
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-xs font-semibold',
              activeFilter === 'overlap'
                ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200'
                : 'bg-muted text-muted-foreground'
            )}>
              {overlappingIds.size}
            </span>
          )}
        </button>

        {/* Chip: Intervalo < 2h */}
        <button
          onClick={() => toggleFilter('short_gap')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors',
            activeFilter === 'short_gap'
              ? 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
              : 'border-border bg-background text-muted-foreground hover:bg-muted'
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          Intervalo &lt; 2h
          {shortGapIds.size > 0 && (
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-xs font-semibold',
              activeFilter === 'short_gap'
                ? 'bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200'
                : 'bg-muted text-muted-foreground'
            )}>
              {shortGapIds.size}
            </span>
          )}
        </button>

        {/* Botão limpar filtros */}
        {hasFilter && (
          <button
            onClick={() => setActiveFilter(null)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
          >
            <X className="w-3.5 h-3.5" />
            Limpar
          </button>
        )}
      </div>

      {/* Banner de conflitos (separado por tipo) */}
      {(overlappingIds.size > 0 || shortGapIds.size > 0) && (
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {overlappingIds.size > 0 && (
              <span className="font-medium text-red-700 dark:text-red-400">
                {overlappingIds.size} com sobreposição de horário
              </span>
            )}
            {shortGapIds.size > 0 && (
              <span className="font-medium text-amber-800 dark:text-amber-300">
                {shortGapIds.size} com intervalo inferior a 2h
              </span>
            )}
          </div>
        </div>
      )}

      {/* Estado de erro */}
      {isError && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          Erro ao carregar eventos. Tente recarregar a página.
        </div>
      )}

      {/* Loading: skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty states */}
      {!isLoading && !isError && displayEvents.length === 0 && (
        <>
          {hasSearch ? (
            <EmptyState
              icon={SearchX}
              title={`Nenhum resultado para "${debouncedSearch}"`}
              description="Tente buscar por outro nome, tema ou contratante."
              action={{ label: 'Limpar busca', onClick: () => setSearchInput('') }}
            />
          ) : isConflictFilter ? (
            <EmptyState
              icon={AlertTriangle}
              title="Nenhum conflito encontrado"
              description={
                activeFilter === 'overlap'
                  ? 'Nenhuma festa com sobreposição de horário.'
                  : 'Nenhuma festa com intervalo inferior a 2h.'
              }
              action={{ label: 'Limpar filtro', onClick: () => setActiveFilter(null) }}
            />
          ) : tab !== 'all' ? (
            <EmptyState
              icon={CalendarX}
              title={`Nenhuma festa para ${
                tab === 'today' ? 'hoje' : tab === 'week' ? 'esta semana' : 'este mês'
              }`}
              description="As festas aparecem automaticamente quando fechadas no Ploomes."
            />
          ) : ploomesActive ? (
            <EmptyState
              icon={PartyPopper}
              title="Aguardando sincronização com Ploomes"
              description="Seus eventos aparecerão aqui após a primeira sincronização."
              action={{ label: 'Configurar Ploomes', onClick: () => router.push('/configuracoes/integracoes/ploomes') }}
            />
          ) : (
            <EmptyState
              icon={PartyPopper}
              title="Nenhuma festa sincronizada ainda"
              description="Configure a integração com Ploomes em Configurações para importar eventos automaticamente."
              action={{ label: 'Criar Evento', onClick: () => router.push('/eventos/novo') }}
            />
          )}
        </>
      )}

      {/* Lista agrupada por dia */}
      {!isLoading && displayEvents.length > 0 && (
        <>
          <div className="space-y-1">
            {Array.from(grouped.entries()).map(([date, dayEvents]) => (
              <div key={date}>
                <EventDayGroup date={date} count={dayEvents.length} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-2">
                  {dayEvents.map((event, idx) => (
                    <div
                      key={event.id}
                      className="animate-fade-up"
                      style={{ animationDelay: `${Math.min(idx, 9) * 50}ms`, animationFillMode: 'backwards' }}
                    >
                      <EventCard
                        event={event}
                        conflictType={
                          overlappingIds.has(event.id) ? 'overlap' :
                          shortGapIds.has(event.id)   ? 'short_gap' :
                          null
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Contador e Load More */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <p className="text-xs text-muted-foreground">
              {isConflictFilter
                ? `${displayEvents.length} evento${displayEvents.length !== 1 ? 's' : ''} com conflito`
                : `Exibindo ${displayEvents.length} de ${total} evento${total !== 1 ? 's' : ''}`
              }
            </p>
            {hasNextPage && !isConflictFilter && (
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="min-w-[140px]"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  'Carregar mais'
                )}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Página principal — wrap com Suspense para useSearchParams
// ─────────────────────────────────────────────────────────────
export default function EventosPage() {
  const router = useRouter()
  const { data: ploomesActive } = usePloomesIntegrationActive(
    useUnitStore((s) => s.activeUnitId)
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Eventos"
        description="Gerencie todos os eventos e festas do buffet"
        actions={
          !ploomesActive ? (
            <Button onClick={() => router.push('/eventos/novo')}>
              Novo Evento
            </Button>
          ) : undefined
        }
      />

      <Suspense fallback={<EventListSkeleton />}>
        <EventosContent />
      </Suspense>
    </div>
  )
}
