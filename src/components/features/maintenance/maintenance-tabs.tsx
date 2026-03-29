'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { ClipboardList, Building2, DollarSign, Clock, Wrench } from 'lucide-react'
import { SupplierList } from './supplier-list'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { MaintenanceCard, MaintenanceCardSkeleton } from './maintenance-card'
import { MaintenanceFilters } from './maintenance-filters'
import { cn } from '@/lib/utils'
import { useMaintenanceOrders, type MaintenanceFilters as Filters } from '@/hooks/use-maintenance'
import { useSectors } from '@/hooks/use-sectors'
import { useRouter as useNextRouter } from 'next/navigation'

// ─────────────────────────────────────────────────────────────
// TAB DEFINITIONS
// ─────────────────────────────────────────────────────────────
const TABS = [
  { id: 'orders',    label: 'Ordens',       icon: ClipboardList },
  { id: 'suppliers', label: 'Fornecedores', icon: Building2 },
  { id: 'costs',     label: 'Custos',       icon: DollarSign },
  { id: 'history',   label: 'Histórico',    icon: Clock },
] as const

type TabId = typeof TABS[number]['id']

// ─────────────────────────────────────────────────────────────
// ORDERS TAB CONTENT
// ─────────────────────────────────────────────────────────────
function OrdersTabContent() {
  const router = useNextRouter()
  const [filters, setFilters] = useState<Filters>({
    status: ['open', 'in_progress', 'waiting_parts'],
    page: 1,
    pageSize: 12,
  })

  const { data, isLoading, isError } = useMaintenanceOrders(filters)
  const { data: sectors = [] } = useSectors(true)

  const orders     = data?.data ?? []
  const totalPages = data?.totalPages ?? 1
  const page       = filters.page ?? 1

  if (isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive text-center">
        Erro ao carregar ordens. Tente recarregar a página.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-card rounded-xl border border-border p-4">
        <MaintenanceFilters
          filters={filters}
          sectors={sectors}
          onFiltersChange={setFilters}
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <MaintenanceCardSkeleton key={i} />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="Registre sua primeira ordem de manutenção"
          description="Controle manutenções preventivas e corretivas em um só lugar. Comece registrando uma nova ordem."
          action={{ label: 'Nova ordem de manutenção', onClick: () => router.push('/manutencao/nova') }}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {orders.map((order) => (
              <MaintenanceCard key={order.id} order={order} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
                disabled={page <= 1}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
                disabled={page >= totalPages}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PLACEHOLDER FOR UPCOMING TABS
// ─────────────────────────────────────────────────────────────
function PlaceholderTab({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
        <Icon className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">Em breve</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// INNER COMPONENT (reads URL state — needs Suspense)
// ─────────────────────────────────────────────────────────────
function MaintenanceTabsInner() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const pathname     = usePathname()

  const activeTab = (searchParams.get('tab') ?? 'orders') as TabId

  function setTab(tab: TabId) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="space-y-4">
      {/* Tab navigation */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-1 sm:gap-6 overflow-x-auto no-scrollbar" aria-label="Abas de manutenção">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 pb-3 pt-1 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                  isActive
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'orders' && <OrdersTabContent />}
      {activeTab === 'suppliers' && <SupplierList />}
      {activeTab === 'costs' && (
        <PlaceholderTab icon={DollarSign} label="Controle de Custos" />
      )}
      {activeTab === 'history' && (
        <PlaceholderTab icon={Clock} label="Histórico de Manutenções" />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PUBLIC EXPORT (wraps in Suspense for useSearchParams)
// ─────────────────────────────────────────────────────────────
export function MaintenanceTabs() {
  return (
    <Suspense fallback={
      <div className="space-y-4">
        <div className="border-b border-border pb-3 flex gap-6">
          {TABS.map((tab) => (
            <div key={tab.id} className="h-4 w-16 skeleton-shimmer rounded" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <MaintenanceCardSkeleton key={i} />)}
        </div>
      </div>
    }>
      <MaintenanceTabsInner />
    </Suspense>
  )
}
