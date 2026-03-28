'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { ChecklistCard, ChecklistCardSkeleton } from '@/components/features/checklists/checklist-card'
import { FilterChip } from '@/components/shared/filter-chip'
import { useChecklists, useChecklistCategories, type ChecklistFilters } from '@/hooks/use-checklists'
import type { ChecklistStatus } from '@/types/database.types'
import type { FilterChipColor } from '@/components/shared/filter-chip'

const STATUS_OPTIONS: { value: ChecklistStatus; label: string; color: FilterChipColor }[] = [
  { value: 'pending',     label: 'Pendente',     color: 'amber' },
  { value: 'in_progress', label: 'Em Andamento', color: 'blue'  },
  { value: 'completed',   label: 'Concluído',    color: 'green' },
  { value: 'cancelled',   label: 'Cancelado',    color: 'gray'  },
]

export default function ChecklistsPage() {
  const router = useRouter()
  const [filters, setFilters] = useState<ChecklistFilters>({ page: 1 })

  const { data, isLoading, isError } = useChecklists(filters)
  const { data: categories = [] } = useChecklistCategories()

  const hasResults = (data?.checklists.length ?? 0) > 0
  const hasMorePages = (data?.page ?? 1) < (data?.totalPages ?? 1)
  const hasFilters = !!(filters.status?.length || filters.categoryId)

  function toggleStatus(s: ChecklistStatus) {
    const current = filters.status ?? []
    const next = current.includes(s)
      ? current.filter((x) => x !== s)
      : [...current, s]
    setFilters((f) => ({ ...f, status: next.length ? next : undefined, page: 1 }))
  }

  function clearFilters() {
    setFilters({ page: 1 })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Checklists"
        description="Acompanhe e preencha os checklists de cada evento"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/checklists/templates')}
          >
            Templates
          </Button>
        }
      />

      {/* ── Filtros ── */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Status:</span>
          {STATUS_OPTIONS.map(({ value, label, color }) => (
            <FilterChip
              key={value}
              label={label}
              color={color}
              active={filters.status?.includes(value) ?? false}
              onClick={() => toggleStatus(value)}
            />
          ))}
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Categoria:</span>
            {categories.map((cat) => (
              <FilterChip
                key={cat.id}
                label={cat.name}
                color="gray"
                active={filters.categoryId === cat.id}
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    categoryId: filters.categoryId === cat.id ? undefined : cat.id,
                    page: 1,
                  }))
                }
              />
            ))}
          </div>
        )}

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" /> Limpar filtros
          </button>
        )}
      </div>

      {/* ── Erro ── */}
      {isError && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          Erro ao carregar checklists. Tente recarregar.
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <ChecklistCardSkeleton key={i} />)}
        </div>
      )}

      {/* ── Empty ── */}
      {!isLoading && !isError && !hasResults && (
        <EmptyState
          icon={ClipboardList}
          title={hasFilters ? 'Nenhum checklist encontrado' : 'Crie seu primeiro checklist'}
          description={hasFilters
            ? 'Tente remover os filtros para ver mais resultados.'
            : 'Comece criando um modelo de checklist e aplique-o aos seus eventos. É rápido!'}
          action={hasFilters
            ? { label: 'Limpar filtros', onClick: clearFilters }
            : { label: 'Criar modelo de checklist', onClick: () => router.push('/checklists/templates/novo') }
          }
        />
      )}

      {/* ── Lista ── */}
      {!isLoading && hasResults && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {data!.checklists.map((cl) => (
              <ChecklistCard key={cl.id} checklist={cl} />
            ))}
          </div>

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
            Exibindo {data!.checklists.length} de {data!.total} checklist
            {data!.total !== 1 ? 's' : ''}
          </p>
        </>
      )}
    </div>
  )
}
