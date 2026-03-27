'use client'

import { useState, useCallback } from 'react'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EventStatusBadge, STATUS_CONFIG } from '@/components/shared/event-status-badge'
import type { EventStatus } from '@/types/database.types'
import type { EventFilters } from '@/hooks/use-events'
import { cn } from '@/lib/utils'
import { useDebounce } from '@/hooks/use-debounce'

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as EventStatus[]

interface EventFiltersProps {
  filters: EventFilters
  onFiltersChange: (filters: EventFilters) => void
}

export function EventFiltersBar({ filters, onFiltersChange }: EventFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search ?? '')

  // Debounce de 300ms na busca
  const debouncedSearch = useDebounce(searchInput, 300)

  // Propagar mudança de busca quando o valor debounced muda
  const prevSearch = filters.search
  if (debouncedSearch !== prevSearch) {
    onFiltersChange({ ...filters, search: debouncedSearch || undefined, page: 1 })
  }

  const toggleStatus = useCallback(
    (status: EventStatus) => {
      const current = filters.status ?? []
      const next = current.includes(status)
        ? current.filter((s) => s !== status)
        : [...current, status]
      onFiltersChange({ ...filters, status: next.length ? next : undefined, page: 1 })
    },
    [filters, onFiltersChange]
  )

  const hasActiveFilters = !!filters.search || (filters.status?.length ?? 0) > 0

  return (
    <div className="space-y-3">
      {/* Linha 1: busca + botão limpar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar por cliente, aniversariante..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9 h-10"
          />
          {searchInput && (
            <button
              onClick={() => {
                setSearchInput('')
                onFiltersChange({ ...filters, search: undefined, page: 1 })
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            className="h-10 px-3 text-sm shrink-0"
            onClick={() => {
              setSearchInput('')
              onFiltersChange({ page: 1 })
            }}
          >
            <X className="w-3.5 h-3.5 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Linha 2: filtros de status (pills clicáveis) */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground self-center">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Status:
        </span>
        {ALL_STATUSES.map((status) => {
          const active = filters.status?.includes(status) ?? false
          return (
            <button
              key={status}
              onClick={() => toggleStatus(status)}
              className={cn(
                'transition-all duration-150',
                active ? 'opacity-100 scale-100' : 'opacity-60 hover:opacity-80'
              )}
            >
              <EventStatusBadge
                status={status}
                size="sm"
                className={active ? 'ring-2 ring-offset-1 ring-current' : ''}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
