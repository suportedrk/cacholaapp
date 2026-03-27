'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, CalendarX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { EventCard, EventCardSkeleton } from '@/components/features/events/event-card'
import { EventFiltersBar } from '@/components/features/events/event-filters'
import { useEvents, type EventFilters } from '@/hooks/use-events'

export default function EventosPage() {
  const router = useRouter()
  const [filters, setFilters] = useState<EventFilters>({ page: 1 })

  const { data, isLoading, isError } = useEvents(filters)

  const hasResults = (data?.events.length ?? 0) > 0
  const hasMorePages = (data?.page ?? 1) < (data?.totalPages ?? 1)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Eventos"
        description="Gerencie todos os eventos e festas do buffet"
        actions={
          <Button onClick={() => router.push('/eventos/novo')}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Evento
          </Button>
        }
      />

      {/* Filtros */}
      <EventFiltersBar filters={filters} onFiltersChange={setFilters} />

      {/* Estado de erro */}
      {isError && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          Erro ao carregar eventos. Tente recarregar a página.
        </div>
      )}

      {/* Loading: skeletons */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <EventCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && !hasResults && (
        <EmptyState
          icon={CalendarX}
          title="Nenhum evento encontrado"
          description="Crie o primeiro evento ou ajuste os filtros de busca."
          action={{ label: 'Criar Evento', onClick: () => router.push('/eventos/novo') }}
        />
      )}

      {/* Lista de eventos */}
      {!isLoading && hasResults && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {data!.events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>

          {/* Load More */}
          {hasMorePages && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
              >
                Carregar mais
              </Button>
            </div>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Exibindo {data!.events.length} de {data!.total} evento{data!.total !== 1 ? 's' : ''}
          </p>
        </>
      )}
    </div>
  )
}
