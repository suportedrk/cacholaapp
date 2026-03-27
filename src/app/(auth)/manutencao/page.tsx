'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { Plus, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { MaintenanceCard, MaintenanceCardSkeleton } from '@/components/features/maintenance/maintenance-card'
import { MaintenanceFilters } from '@/components/features/maintenance/maintenance-filters'
import { useMaintenanceOrders, type MaintenanceFilters as Filters } from '@/hooks/use-maintenance'
import { useSectors } from '@/hooks/use-sectors'

// ─────────────────────────────────────────────────────────────
// CONTEÚDO PRINCIPAL
// ─────────────────────────────────────────────────────────────
function ManutencaoContent() {
  const [filters, setFilters] = useState<Filters>({
    status: ['open', 'in_progress', 'waiting_parts'], // default: excluir concluídas
    page: 1,
    pageSize: 12,
  })

  const { data, isLoading, isError } = useMaintenanceOrders(filters)
  const { data: sectors = [] } = useSectors(true)

  const orders = data?.data ?? []
  const totalPages = data?.totalPages ?? 1
  const page = filters.page ?? 1

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
          title="Nenhuma ordem encontrada"
          description="Nenhuma ordem corresponde aos filtros selecionados. Tente ajustar ou limpar os filtros."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {orders.map((order) => (
              <MaintenanceCard key={order.id} order={order} />
            ))}
          </div>

          {/* Paginação */}
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
// PÁGINA
// ─────────────────────────────────────────────────────────────
export default function ManutencaoPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Manutenção"
        description="Gerencie ordens de serviço, manutenções preventivas e emergenciais"
        actions={
          <Link href="/manutencao/nova">
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Nova Ordem
            </Button>
          </Link>
        }
      />
      <Suspense fallback={
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <MaintenanceCardSkeleton key={i} />)}
        </div>
      }>
        <ManutencaoContent />
      </Suspense>
    </div>
  )
}
