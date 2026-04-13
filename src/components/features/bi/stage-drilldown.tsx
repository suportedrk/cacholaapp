'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { DrilldownDealCard } from './drilldown-deal-card'
import { useStageDrilldownDeals } from '@/hooks/use-stage-drilldown-deals'
import { useUnitStore } from '@/stores/unit-store'

// ── Constants ─────────────────────────────────────────────────

const PAGE_SIZE = 20

const STATUS_FILTERS = [
  { label: 'Todos',     value: null },
  { label: 'Em aberto', value: 1 },
  { label: 'Ganhos',    value: 2 },
  { label: 'Perdidos',  value: 3 },
] as const

// ── Types ─────────────────────────────────────────────────────

interface Props {
  isOpen: boolean
  onClose: () => void
  stageId: number
  stageName: string
  stageTotal: number
}

// ── Debounce helper ───────────────────────────────────────────

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

// ── Component ─────────────────────────────────────────────────

export function StageDrilldown({ isOpen, onClose, stageId, stageName, stageTotal }: Props) {
  const { activeUnitId } = useUnitStore()

  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState<number | null>(null)
  const [page,         setPage]         = useState(0)

  const debouncedSearch = useDebounce(search, 300)

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [debouncedSearch, statusFilter])

  // Reset all state when slide-over opens a new stage
  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setStatusFilter(null)
      setPage(0)
    }
  }, [isOpen, stageId])

  const { data, isLoading, isFetching } = useStageDrilldownDeals({
    stageId:      isOpen ? stageId : null,
    unitId:       activeUnitId ?? null,
    statusFilter,
    search:       debouncedSearch,
    page,
    pageSize:     PAGE_SIZE,
  })

  const totalCount  = data?.totalCount ?? 0
  const totalPages  = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const fromItem    = totalCount === 0 ? 0 : page * PAGE_SIZE + 1
  const toItem      = Math.min((page + 1) * PAGE_SIZE, totalCount)

  const handlePrev = useCallback(() => setPage((p) => Math.max(0, p - 1)), [])
  const handleNext = useCallback(() => setPage((p) => Math.min(totalPages - 1, p + 1)), [totalPages])

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent
        side="right"
        showCloseButton
        className="w-full sm:max-w-lg flex flex-col gap-0 p-0"
      >
        {/* ── Header ── */}
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border-default shrink-0">
          <SheetTitle className="text-base font-semibold text-text-primary pr-8">
            {stageName}
            <span className="ml-2 text-sm font-normal text-text-tertiary">
              ({stageTotal.toLocaleString('pt-BR')} deals)
            </span>
          </SheetTitle>
        </SheetHeader>

        {/* ── Filters ── */}
        <div className="px-4 py-3 border-b border-border-default space-y-2.5 shrink-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border-default bg-surface-secondary text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-border-focus"
            />
          </div>

          {/* Status pills */}
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => {
              const isActive = statusFilter === f.value
              return (
                <button
                  key={String(f.value)}
                  onClick={() => setStatusFilter(f.value)}
                  className={
                    isActive
                      ? 'px-3 py-1 rounded-full text-xs font-semibold bg-primary text-primary-foreground transition-colors'
                      : 'px-3 py-1 rounded-full text-xs font-semibold bg-surface-tertiary text-text-secondary hover:bg-surface-secondary border border-border-default transition-colors'
                  }
                >
                  {f.label}
                </button>
              )
            })}
            {isFetching && !isLoading && (
              <Loader2 className="w-4 h-4 text-text-tertiary animate-spin self-center ml-1" />
            )}
          </div>
        </div>

        {/* ── Deal list ── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border-default bg-surface-secondary p-3 space-y-2">
                <div className="flex justify-between gap-2">
                  <Skeleton className="h-4 w-48 skeleton-shimmer" />
                  <Skeleton className="h-4 w-16 skeleton-shimmer rounded-full" />
                </div>
                <Skeleton className="h-3 w-32 skeleton-shimmer" />
                <Skeleton className="h-3 w-40 skeleton-shimmer" />
              </div>
            ))
          ) : (data?.deals.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <Search className="w-8 h-8 text-text-tertiary" />
              <p className="text-sm text-text-secondary">
                {debouncedSearch || statusFilter != null
                  ? 'Nenhum deal encontrado para os filtros aplicados.'
                  : 'Nenhum deal neste stage.'}
              </p>
            </div>
          ) : (
            data!.deals.map((deal) => (
              <DrilldownDealCard key={deal.id} deal={deal} />
            ))
          )}
        </div>

        {/* ── Pagination footer ── */}
        {!isLoading && totalCount > 0 && (
          <div className="shrink-0 border-t border-border-default px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-xs text-text-tertiary">
              {fromItem}–{toItem} de {totalCount.toLocaleString('pt-BR')} deals
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                disabled={page === 0}
                className="h-7 px-2"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="sr-only">Anterior</span>
              </Button>
              <span className="text-xs text-text-secondary px-2 tabular-nums">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={page >= totalPages - 1}
                className="h-7 px-2"
              >
                <ChevronRight className="w-4 h-4" />
                <span className="sr-only">Próxima</span>
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
