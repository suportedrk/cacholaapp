'use client'

import dynamic from 'next/dynamic'
import { Suspense, useState } from 'react'
import { format, subMonths } from 'date-fns'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/shared/page-header'
import { ReportFiltersBar } from '@/components/features/reports/report-filters'
import { useUnitStore } from '@/stores/unit-store'
import type { ReportFilters } from '@/types/database.types'

// Code-split pesado — só carrega na rota /relatorios
const EventsTab = dynamic(
  () => import('@/components/features/reports/events-tab').then((m) => ({ default: m.EventsTab })),
  { loading: () => <TabSkeleton />, ssr: false }
)
const MaintenanceTab = dynamic(
  () => import('@/components/features/reports/maintenance-tab').then((m) => ({ default: m.MaintenanceTab })),
  { loading: () => <TabSkeleton />, ssr: false }
)
const ChecklistsTab = dynamic(
  () => import('@/components/features/reports/checklists-tab').then((m) => ({ default: m.ChecklistsTab })),
  { loading: () => <TabSkeleton />, ssr: false }
)
const StaffTab = dynamic(
  () => import('@/components/features/reports/staff-tab').then((m) => ({ default: m.StaffTab })),
  { loading: () => <TabSkeleton />, ssr: false }
)

function TabSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-muted rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="h-72 bg-muted rounded-xl lg:col-span-2" />
        <div className="h-72 bg-muted rounded-xl" />
      </div>
      <div className="h-64 bg-muted rounded-xl" />
    </div>
  )
}

// Defaults: último mês
const DEFAULT_FROM = format(subMonths(new Date(), 1), 'yyyy-MM-dd')
const DEFAULT_TO   = format(new Date(), 'yyyy-MM-dd')

const TABS = [
  { value: 'eventos',      label: 'Eventos' },
  { value: 'manutencoes',  label: 'Manutenções' },
  { value: 'checklists',   label: 'Checklists' },
  { value: 'equipe',       label: 'Equipe' },
]

export default function RelatoriosPage() {
  const { activeUnitId, activeUnit } = useUnitStore()
  const [activeTab, setActiveTab] = useState('eventos')
  const [filters, setFilters] = useState<ReportFilters>({
    from:   DEFAULT_FROM,
    to:     DEFAULT_TO,
    unitId: activeUnitId,
  })

  // Quando o filtro de período muda, manter unitId do store
  function handleFilterChange(f: ReportFilters) {
    setFilters({ ...f, unitId: activeUnitId })
  }

  const unitName = activeUnit
    ? (activeUnit as { name: string }).name
    : 'Todas as unidades'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Relatórios"
        description="Visualize métricas e indicadores de desempenho do buffet"
      />

      {/* Filtros globais */}
      <div className="rounded-xl border bg-card px-5 py-4">
        <ReportFiltersBar
          value={filters}
          onChange={handleFilterChange}
        />
      </div>

      {/* Abas */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:flex">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs sm:text-sm">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="eventos" className="mt-6">
          <Suspense fallback={<TabSkeleton />}>
            <EventsTab filters={filters} unitName={unitName} />
          </Suspense>
        </TabsContent>

        <TabsContent value="manutencoes" className="mt-6">
          <Suspense fallback={<TabSkeleton />}>
            <MaintenanceTab filters={filters} unitName={unitName} />
          </Suspense>
        </TabsContent>

        <TabsContent value="checklists" className="mt-6">
          <Suspense fallback={<TabSkeleton />}>
            <ChecklistsTab filters={filters} unitName={unitName} />
          </Suspense>
        </TabsContent>

        <TabsContent value="equipe" className="mt-6">
          <Suspense fallback={<TabSkeleton />}>
            <StaffTab filters={filters} unitName={unitName} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
