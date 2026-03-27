'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { ChecklistCard, ChecklistCardSkeleton } from '@/components/features/checklists/checklist-card'
import { useChecklists, useChecklistCategories, type ChecklistFilters } from '@/hooks/use-checklists'
import { cn } from '@/lib/utils'
import type { ChecklistStatus } from '@/types/database.types'

const STATUS_OPTIONS: { value: ChecklistStatus; label: string }[] = [
  { value: 'pending',     label: 'Pendente'     },
  { value: 'in_progress', label: 'Em Andamento' },
  { value: 'completed',   label: 'Concluído'    },
  { value: 'cancelled',   label: 'Cancelado'    },
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
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Status:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map(({ value, label }) => {
            const active = filters.status?.includes(value) ?? false
            return (
              <button
                key={value}
                onClick={() => toggleStatus(value)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted'
                )}
              >
                {label}
              </button>
            )
          })}
        </div>

        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {categories.map((cat) => {
              const active = filters.categoryId === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() =>
                    setFilters((f) => ({
                      ...f,
                      categoryId: active ? undefined : cat.id,
                      page: 1,
                    }))
                  }
                  className={cn(
                    'px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
                    active
                      ? 'bg-secondary text-secondary-foreground border-secondary'
                      : 'bg-background text-muted-foreground border-border hover:bg-muted'
                  )}
                >
                  {cat.name}
                </button>
              )
            })}
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
          title="Nenhum checklist encontrado"
          description={hasFilters
            ? 'Tente remover os filtros para ver mais checklists.'
            : 'Crie um checklist a partir do detalhe de um evento.'}
          action={hasFilters
            ? { label: 'Limpar filtros', onClick: clearFilters }
            : { label: 'Ver Eventos', onClick: () => router.push('/eventos') }
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
