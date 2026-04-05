'use client'

import { Suspense, useState, useCallback, useMemo } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Info, SearchX, PartyPopper, CalendarX, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { FilterChip } from '@/components/shared/filter-chip'
import { EventCard, EventCardSkeleton } from '@/components/features/events/event-card'
import { EventTemporalTabs } from '@/components/features/events/event-temporal-tabs'
import { EventDayGroup } from '@/components/features/events/event-day-group'
import { EventsKpiCards } from '@/components/features/events/events-kpi-cards'
import { useEventsInfinite, useEventsTabCounts, useEventsKpis, type TabKey } from '@/hooks/use-events'
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

const MAIN_STATUSES = (Object.keys(STATUS_CONFIG) as EventStatus[]).filter((s) => s !== 'lost')

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
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

  // Filtros locais
  const [statusFilters, setStatusFilters] = useState<EventStatus[]>([])
  const [searchInput, setSearchInput]     = useState('')
  const debouncedSearch = useDebounce(searchInput, 300)

  const { data: ploomesActive } = usePloomesIntegrationActive(activeUnitId)
  const { data: tabCounts, isLoading: countsLoading } = useEventsTabCounts()
  const { data: kpis, isLoading: kpisLoading } = useEventsKpis()

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useEventsInfinite({
    tab,
    status: statusFilters,
    search: debouncedSearch || undefined,
  })

  const { isTimedOut, retry } = useLoadingTimeout(isLoading)

  // Achata todas as páginas em lista única
  const allEvents = useMemo(
    () => data?.pages.flatMap((p) => p.events) ?? [],
    [data]
  )
  const total   = data?.pages[0]?.total ?? 0
  const grouped = useMemo(() => groupEventsByDate(allEvents), [allEvents])

  // Troca de aba: atualiza URL, limpa filtros de status
  const handleTabChange = useCallback((newTab: TabKey) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', newTab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    setStatusFilters([])
  }, [searchParams, pathname, router])

  // Toggle de status (multi-select)
  const toggleStatus = useCallback((status: EventStatus) => {
    setStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    )
  }, [])

  const hasSearch  = debouncedSearch.trim().length > 0
  const hasFilters = statusFilters.length > 0

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
      {/* Banner Ploomes ativo */}
      {ploomesActive && (
        <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
          <p>
            Os eventos são gerenciados pelo <strong>Ploomes CRM</strong>. Use o Cachola OS para operar as festas.
            {' '}<a href="/configuracoes/integracoes/ploomes" className="underline underline-offset-2 hover:text-blue-900 dark:hover:text-blue-100 transition-colors">Configurar integração</a>
          </p>
        </div>
      )}

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

      {/* Chips de status */}
      <div className="flex flex-wrap items-center gap-2">
        {MAIN_STATUSES.map((status) => (
          <FilterChip
            key={status}
            label={STATUS_CONFIG[status].label}
            active={statusFilters.includes(status)}
            color={STATUS_COLOR[status]}
            onClick={() => toggleStatus(status)}
          />
        ))}
        {/* Separador + "Perdido" */}
        <span className="w-px h-5 bg-border self-center mx-0.5" />
        <FilterChip
          label="Perdido"
          active={statusFilters.includes('lost')}
          color="gray"
          onClick={() => toggleStatus('lost')}
        />
        {/* Botão limpar filtros */}
        {hasFilters && (
          <button
            onClick={() => setStatusFilters([])}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
          >
            <X className="w-3.5 h-3.5" />
            Limpar
          </button>
        )}
      </div>

      {/* Estado de erro */}
      {isError && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          Erro ao carregar eventos. Tente recarregar a página.
        </div>
      )}

      {/* Loading: skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty states */}
      {!isLoading && !isError && allEvents.length === 0 && (
        <>
          {hasSearch ? (
            <EmptyState
              icon={SearchX}
              title={`Nenhum resultado para "${debouncedSearch}"`}
              description="Tente buscar por outro nome, tema ou contratante."
              action={{ label: 'Limpar busca', onClick: () => setSearchInput('') }}
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
      {!isLoading && allEvents.length > 0 && (
        <>
          <div className="space-y-1">
            {Array.from(grouped.entries()).map(([date, dayEvents]) => (
              <div key={date}>
                <EventDayGroup date={date} count={dayEvents.length} />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3 mt-2">
                  {dayEvents.map((event, idx) => (
                    <div
                      key={event.id}
                      className="animate-fade-up"
                      style={{ animationDelay: `${Math.min(idx, 9) * 50}ms`, animationFillMode: 'backwards' }}
                    >
                      <EventCard event={event} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Contador e Load More */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <p className="text-xs text-muted-foreground">
              Exibindo {allEvents.length} de {total} evento{total !== 1 ? 's' : ''}
            </p>
            {hasNextPage && (
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
