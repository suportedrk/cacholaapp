'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, CalendarX, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { EventCard, EventCardSkeleton } from '@/components/features/events/event-card'
import { EventFiltersBar } from '@/components/features/events/event-filters'
import { useEvents, type EventFilters } from '@/hooks/use-events'
import { usePloomesIntegrationActive } from '@/hooks/use-ploomes-sync'
import { useUnitStore } from '@/stores/unit-store'

export default function EventosPage() {
  const router = useRouter()
  const [filters, setFilters] = useState<EventFilters>({ page: 1 })
  const activeUnitId = useUnitStore((s) => s.activeUnitId)

  const { data, isLoading, isError } = useEvents(filters)
  const { data: ploomesActive } = usePloomesIntegrationActive(activeUnitId)

  const hasResults = (data?.events.length ?? 0) > 0
  const hasMorePages = (data?.page ?? 1) < (data?.totalPages ?? 1)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Eventos"
        description="Gerencie todos os eventos e festas do buffet"
        actions={
          !ploomesActive ? (
            <Button onClick={() => router.push('/eventos/novo')}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Evento
            </Button>
          ) : undefined
        }
      />

      {/* Banner Ploomes ativo */}
      {ploomesActive && (
        <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-500" />
          <p>
            Os eventos são gerenciados pelo <strong>Ploomes CRM</strong>. Use o Cachola OS para operar as festas — atribuir checklists, equipe, manutenção e fotos.
            {' '}<a href="/configuracoes/integracoes/ploomes" className="underline underline-offset-2 hover:text-blue-900 transition-colors">Configurar integração</a>
          </p>
        </div>
      )}

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
          description={ploomesActive ? 'Sincronize os eventos do Ploomes ou ajuste os filtros.' : 'Crie o primeiro evento ou ajuste os filtros de busca.'}
          action={!ploomesActive ? { label: 'Criar Evento', onClick: () => router.push('/eventos/novo') } : undefined}
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
