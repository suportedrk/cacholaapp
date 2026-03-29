'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ClipboardList, LayoutTemplate, Plus } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils'
import { useChecklists } from '@/hooks/use-checklists'
import { ChecklistKPIs } from './components/checklist-kpis'
import {
  ChecklistFiltersBar,
  useChecklistUrlFilters,
} from './components/checklist-filters-bar'
import {
  ChecklistCard,
  ChecklistCardSkeleton,
} from './components/checklist-card'
import { CreateChecklistModal } from './components/create-checklist-modal'
import type { ChecklistFilters } from '@/hooks/use-checklists'

// ─────────────────────────────────────────────────────────────
// CONTENT — usa useSearchParams (dentro do Suspense)
// ─────────────────────────────────────────────────────────────
function ChecklistsContent() {
  const router = useRouter()
  const { q, statuses, type, priority, categoryId, overdue, page } =
    useChecklistUrlFilters()

  const filters: ChecklistFilters = {
    search:     q || undefined,
    status:     statuses.length ? statuses : undefined,
    type:       type || undefined,
    priority:   priority || undefined,
    categoryId: categoryId || undefined,
    overdue:    overdue || undefined,
    page,
    pageSize:   18,
  }

  const { data, isLoading, isError } = useChecklists(filters)

  const checklists = data?.checklists ?? []
  const total      = data?.total ?? 0
  const hasMore    = (data?.page ?? 1) < (data?.totalPages ?? 1)
  const hasFilters = !!(q || statuses.length || type || priority || categoryId || overdue)

  // ── Empty states ──────────────────────────────────────────
  if (!isLoading && !isError && checklists.length === 0) {
    if (hasFilters) {
      return (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum checklist encontrado"
          description="Tente ajustar ou remover os filtros para ver mais resultados."
          action={{
            label: 'Limpar filtros',
            onClick: () => window.history.pushState({}, '', window.location.pathname),
          }}
        />
      )
    }

    // Empty sem filtros: sugere criar template ou checklist
    return (
      <EmptyState
        icon={ClipboardList}
        title="Nenhum checklist ainda"
        description="Crie um modelo de checklist e aplique-o aos seus eventos, ou adicione um checklist avulso."
        action={{
          label: 'Criar modelo de checklist',
          onClick: () => router.push('/checklists/templates/novo'),
        }}
      />
    )
  }

  return (
    <>
      {/* ── Error ── */}
      {isError && (
        <div className="p-4 rounded-lg bg-status-error-bg border border-status-error-border text-sm text-status-error-text">
          Erro ao carregar checklists. Tente recarregar a página.
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <ChecklistCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* ── Grid ── */}
      {!isLoading && checklists.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {checklists.map((cl, i) => (
              <div
                key={cl.id}
                className="animate-fade-up"
                style={{ animationDelay: `${Math.min(i * 30, 300)}ms`, animationFillMode: 'backwards' }}
              >
                <ChecklistCard checklist={cl} />
              </div>
            ))}
          </div>

          {/* Footer: count + load more */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <p className="text-xs text-muted-foreground">
              Exibindo {checklists.length} de {total} checklist
              {total !== 1 ? 's' : ''}
            </p>
            {hasMore && (
              <LoadMoreButton currentPage={page} />
            )}
          </div>
        </>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// LOAD MORE BUTTON
// ─────────────────────────────────────────────────────────────
function LoadMoreButton({ currentPage }: { currentPage: number }) {
  const router = useRouter()
  const nextPage = currentPage + 1

  function handleLoadMore() {
    const params = new URLSearchParams(window.location.search)
    params.set('page', String(nextPage))
    router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false })
  }

  return (
    <Button variant="outline" onClick={handleLoadMore}>
      Carregar mais
    </Button>
  )
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default function ChecklistsPage() {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Checklists"
        description="Acompanhe e preencha os checklists operacionais"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/checklists/templates"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              <LayoutTemplate className="w-4 h-4 mr-1.5" />
              Templates
            </Link>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Novo
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <ChecklistKPIs />

      {/* Filtros */}
      <ChecklistFiltersBar />

      {/* Grid de resultados — Suspense para useSearchParams */}
      <Suspense
        fallback={
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => <ChecklistCardSkeleton key={i} />)}
          </div>
        }
      >
        <ChecklistsContent />
      </Suspense>

      <CreateChecklistModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          setCreateOpen(false)
          router.push(`/checklists/${id}`)
        }}
      />
    </div>
  )
}
