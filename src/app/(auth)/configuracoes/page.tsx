'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/page-header'
import { ConfigTable, type ConfigItem } from '@/components/features/settings/config-table'
import { GeneralSettingsTab } from '@/components/features/settings/general-settings-tab'
import { BusinessHoursTab } from '@/components/features/settings/business-hours-tab'
import { BrandIdentityTab } from '@/components/features/settings/brand-identity-tab'
import {
  useEventTypes, useCreateEventType, useUpdateEventType, useDeleteEventType,
  usePackages, useCreatePackage, useUpdatePackage, useDeletePackage,
  useVenues, useCreateVenue, useUpdateVenue, useDeleteVenue,
} from '@/hooks/use-event-config'
import { useSectors, useCreateSector, useUpdateSector, useDeleteSector } from '@/hooks/use-sectors'
import {
  useEquipmentCategoryItems,
  useCreateEquipmentCategory,
  useUpdateEquipmentCategory,
  useDeleteEquipmentCategory,
} from '@/hooks/use-equipment-categories'

export default function ConfiguracoesPage() {
  // ── Tipos de Evento ──────────────────────────────────────
  const { data: eventTypes = [], isLoading: loadingTypes, isError: errorTypes, refetch: refetchTypes } = useEventTypes(false)
  const createType = useCreateEventType()
  const updateType = useUpdateEventType()
  const deleteType = useDeleteEventType()

  // ── Pacotes ──────────────────────────────────────────────
  const { data: packages = [], isLoading: loadingPackages, isError: errorPackages, refetch: refetchPackages } = usePackages(false)
  const createPkg = useCreatePackage()
  const updatePkg = useUpdatePackage()
  const deletePkg = useDeletePackage()

  // ── Salões ───────────────────────────────────────────────
  const { data: venues = [], isLoading: loadingVenues, isError: errorVenues, refetch: refetchVenues } = useVenues(false)
  const createVenue = useCreateVenue()
  const updateVenue = useUpdateVenue()
  const deleteVenue = useDeleteVenue()

  // ── Setores (manutenção) ─────────────────────────────────
  const { data: sectors = [], isLoading: loadingSectors, isError: errorSectors, refetch: refetchSectors } = useSectors(false)
  const createSector = useCreateSector()
  const updateSector = useUpdateSector()
  const deleteSector = useDeleteSector()

  // ── Categorias de Equipamento ────────────────────────────
  const { data: equipCats = [], isLoading: loadingEquipCats, isError: errorEquipCats, refetch: refetchEquipCats } = useEquipmentCategoryItems(false)
  const createEquipCat = useCreateEquipmentCategory()
  const updateEquipCat = useUpdateEquipmentCategory()
  const deleteEquipCat = useDeleteEquipmentCategory()

  // Se alguma query de configuração falhou (após a sessão estar pronta), mostra um aviso
  const hasError = errorTypes || errorPackages || errorVenues || errorSectors || errorEquipCats
  const refetchAll = () => { void refetchTypes(); void refetchPackages(); void refetchVenues(); void refetchSectors(); void refetchEquipCats() }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações"
        description="Gerencie as configurações operacionais da unidade"
      />

      {hasError && (
        <div className="flex items-center justify-between rounded-xl border border-status-error-border bg-status-error-bg px-4 py-3 text-sm text-status-error-text">
          <span>Não foi possível carregar algumas configurações.</span>
          <button
            onClick={refetchAll}
            className="ml-4 shrink-0 rounded-md border border-status-error-border bg-background px-3 py-1 text-xs font-medium hover:bg-muted transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <Tabs defaultValue="tipos">
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="min-w-max">
            <TabsTrigger value="tipos">Tipos de Evento</TabsTrigger>
            <TabsTrigger value="pacotes">Pacotes</TabsTrigger>
            <TabsTrigger value="saloes">Salões</TabsTrigger>
            <TabsTrigger value="setores">Setores</TabsTrigger>
            <TabsTrigger value="categorias-equip">Categ. Equipamentos</TabsTrigger>
            <TabsTrigger value="horarios">Horários</TabsTrigger>
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="identidade">Identidade Visual</TabsTrigger>
            <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          </TabsList>
        </div>

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

        {/* ── Setores ── */}
        <TabsContent value="setores" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Setores do buffet para vinculação das ordens de manutenção (ex: Cozinha, Salão Principal).
          </p>
          <ConfigTable
            title="Setor"
            items={sectors as ConfigItem[]}
            isLoading={loadingSectors}
            onCreate={(d) => createSector.mutateAsync(d as { name: string })}
            onUpdate={(id, d) => updateSector.mutateAsync({ id, data: d })}
            onDelete={(id) => deleteSector.mutateAsync(id)}
          />
        </TabsContent>

        {/* ── Categorias de Equipamento ── */}
        <TabsContent value="categorias-equip" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Categorias para classificar os equipamentos do buffet. Alimentam o select no cadastro de equipamentos.
          </p>
          <ConfigTable
            title="Categoria"
            items={equipCats as ConfigItem[]}
            isLoading={loadingEquipCats}
            onCreate={async (d) => { await createEquipCat.mutateAsync(d as { name: string }) }}
            onUpdate={async (id, d) => { await updateEquipCat.mutateAsync({ id, data: d }) }}
            onDelete={(id) => deleteEquipCat.mutateAsync(id)}
          />
        </TabsContent>

        {/* ── Horários Padrão ── */}
        <TabsContent value="horarios" className="mt-4">
          <BusinessHoursTab />
        </TabsContent>

        {/* ── Configurações Gerais ── */}
        <TabsContent value="geral" className="mt-4">
          <GeneralSettingsTab />
        </TabsContent>

        {/* ── Identidade Visual ── */}
        <TabsContent value="identidade" className="mt-4">
          <BrandIdentityTab />
        </TabsContent>

        {/* ── Integrações ── */}
        <TabsContent value="integracoes" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Integrações com sistemas externos para importar e exportar dados do Cachola OS.
          </p>
          <Link
            href="/configuracoes/integracoes/ploomes"
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4 card-interactive group"
          >
            <div className="space-y-0.5">
              <p className="font-medium text-sm group-hover:text-primary transition-colors">Ploomes CRM</p>
              <p className="text-xs text-muted-foreground">
                Sincronize festas fechadas do Ploomes automaticamente com o calendário do Cachola OS.
              </p>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </Link>
        </TabsContent>
      </Tabs>
    </div>
  )
}
