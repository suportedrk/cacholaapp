'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/page-header'
import { ConfigTable, type ConfigItem } from '@/components/features/settings/config-table'
import {
  useEventTypes, useCreateEventType, useUpdateEventType, useDeleteEventType,
  usePackages, useCreatePackage, useUpdatePackage, useDeletePackage,
  useVenues, useCreateVenue, useUpdateVenue, useDeleteVenue,
} from '@/hooks/use-event-config'

export default function ConfiguracoesPage() {
  // Tipos de Evento
  const { data: eventTypes = [], isLoading: loadingTypes } = useEventTypes(false)
  const createType  = useCreateEventType()
  const updateType  = useUpdateEventType()
  const deleteType  = useDeleteEventType()

  // Pacotes
  const { data: packages = [], isLoading: loadingPackages } = usePackages(false)
  const createPkg = useCreatePackage()
  const updatePkg = useUpdatePackage()
  const deletePkg = useDeletePackage()

  // Salões
  const { data: venues = [], isLoading: loadingVenues } = useVenues(false)
  const createVenue = useCreateVenue()
  const updateVenue = useUpdateVenue()
  const deleteVenue = useDeleteVenue()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Gerencie tipos de evento, pacotes e salões"
      />

      <Tabs defaultValue="tipos">
        <TabsList>
          <TabsTrigger value="tipos">Tipos de Evento</TabsTrigger>
          <TabsTrigger value="pacotes">Pacotes</TabsTrigger>
          <TabsTrigger value="saloes">Salões</TabsTrigger>
        </TabsList>

        {/* ── Tipos de Evento ── */}
        <TabsContent value="tipos" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Categorias de eventos disponíveis nos formulários (ex: Aniversário, Casamento).
          </p>
          <ConfigTable
            title="Tipo"
            items={eventTypes as ConfigItem[]}
            isLoading={loadingTypes}
            onCreate={(d) => createType.mutateAsync(d as { name: string })}
            onUpdate={(id, d) => updateType.mutateAsync({ id, data: d })}
            onDelete={(id) => deleteType.mutateAsync(id)}
          />
        </TabsContent>

        {/* ── Pacotes ── */}
        <TabsContent value="pacotes" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Pacotes oferecidos pelo buffet (ex: Básico, Premium, Luxo).
          </p>
          <ConfigTable
            title="Pacote"
            items={packages as ConfigItem[]}
            isLoading={loadingPackages}
            onCreate={(d) => createPkg.mutateAsync(d as { name: string })}
            onUpdate={(id, d) => updatePkg.mutateAsync({ id, data: d })}
            onDelete={(id) => deletePkg.mutateAsync(id)}
          />
        </TabsContent>

        {/* ── Salões ── */}
        <TabsContent value="saloes" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Locais disponíveis para realização dos eventos.
          </p>
          <ConfigTable
            title="Salão"
            items={venues as ConfigItem[]}
            isLoading={loadingVenues}
            extraField={{ key: 'capacity', label: 'Capacidade', placeholder: 'Ex: 200', type: 'number' }}
            onCreate={(d) => createVenue.mutateAsync(d as { name: string; capacity?: number })}
            onUpdate={(id, d) => updateVenue.mutateAsync({ id, data: d })}
            onDelete={(id) => deleteVenue.mutateAsync(id)}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
