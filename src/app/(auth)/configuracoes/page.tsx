'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/page-header'
import { ConfigTable, type ConfigItem } from '@/components/features/settings/config-table'
import { GeneralSettingsTab } from '@/components/features/settings/general-settings-tab'
import { BusinessHoursTab } from '@/components/features/settings/business-hours-tab'
import { BrandIdentityTab } from '@/components/features/settings/brand-identity-tab'
import { UnitPickerBanner } from '@/components/features/maintenance/unit-picker-banner'
import { useFormUnitSelection } from '@/hooks/use-form-unit-selection'
import { useSectors, useCreateSector, useUpdateSector, useDeleteSector } from '@/hooks/use-sectors'
import {
  useEquipmentCategoryItems,
  useCreateEquipmentCategory,
  useUpdateEquipmentCategory,
  useDeleteEquipmentCategory,
} from '@/hooks/use-equipment-categories'

export default function ConfiguracoesPage() {
  // Em "Todas as unidades", cada aba precisa de uma unidade explícita para criação.
  // A escolha é por aba (cada lista é independente).
  const [sectorsUnitId, setSectorsUnitId] = useState<string>('')
  const [equipCatsUnitId, setEquipCatsUnitId] = useState<string>('')

  const sectorsUnit = useFormUnitSelection(sectorsUnitId || null)
  const equipCatsUnit = useFormUnitSelection(equipCatsUnitId || null)

  // ── Setores (manutenção) ─────────────────────────────────
  const { data: sectors = [], isLoading: loadingSectors, isError: errorSectors, refetch: refetchSectors } =
    useSectors(false, sectorsUnit.effectiveUnitId)
  const createSector = useCreateSector()
  const updateSector = useUpdateSector()
  const deleteSector = useDeleteSector()

  // ── Categorias de Equipamento ────────────────────────────
  const { data: equipCats = [], isLoading: loadingEquipCats, isError: errorEquipCats, refetch: refetchEquipCats } =
    useEquipmentCategoryItems(false, equipCatsUnit.effectiveUnitId)
  const createEquipCat = useCreateEquipmentCategory()
  const updateEquipCat = useUpdateEquipmentCategory()
  const deleteEquipCat = useDeleteEquipmentCategory()

  // Se alguma query de configuração falhou (após a sessão estar pronta), mostra um aviso
  const hasError = errorSectors || errorEquipCats
  const refetchAll = () => { void refetchSectors(); void refetchEquipCats() }

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

      <Tabs defaultValue="setores">
        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <TabsList className="min-w-max">
            <TabsTrigger value="setores">Setores</TabsTrigger>
            <TabsTrigger value="categorias-equip">Categ. Equipamentos</TabsTrigger>
            <TabsTrigger value="horarios">Horários</TabsTrigger>
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="identidade">Identidade Visual</TabsTrigger>
            <TabsTrigger value="integracoes">Integrações</TabsTrigger>
          </TabsList>
        </div>




        {/* ── Setores ── */}
        <TabsContent value="setores" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Setores do buffet para vinculação das ordens de manutenção (ex: Cozinha, Salão Principal).
          </p>
          {sectorsUnit.requiresUnitSelection && (
            <UnitPickerBanner
              value={sectorsUnitId}
              onChange={setSectorsUnitId}
              units={sectorsUnit.availableUnits}
              contextLabel="criar setores"
            />
          )}
          <ConfigTable
            title="Setor"
            items={sectors as ConfigItem[]}
            isLoading={loadingSectors}
            canCreate={!sectorsUnit.requiresUnitSelection || !!sectorsUnit.effectiveUnitId}
            onCreate={(d) =>
              createSector.mutateAsync({
                name: (d as { name: string }).name,
                unit_id: sectorsUnit.effectiveUnitId,
              })
            }
            onUpdate={(id, d) => updateSector.mutateAsync({ id, data: d })}
            onDelete={(id) => deleteSector.mutateAsync(id)}
          />
        </TabsContent>

        {/* ── Categorias de Equipamento ── */}
        <TabsContent value="categorias-equip" className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Categorias para classificar os equipamentos do buffet. Alimentam o select no cadastro de equipamentos.
          </p>
          {equipCatsUnit.requiresUnitSelection && (
            <UnitPickerBanner
              value={equipCatsUnitId}
              onChange={setEquipCatsUnitId}
              units={equipCatsUnit.availableUnits}
              contextLabel="criar categorias de equipamento"
            />
          )}
          <ConfigTable
            title="Categoria"
            items={equipCats as ConfigItem[]}
            isLoading={loadingEquipCats}
            canCreate={!equipCatsUnit.requiresUnitSelection || !!equipCatsUnit.effectiveUnitId}
            onCreate={async (d) => {
              if (!equipCatsUnit.effectiveUnitId) return
              await createEquipCat.mutateAsync({
                name: (d as { name: string }).name,
                unit_id: equipCatsUnit.effectiveUnitId,
              })
            }}
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
