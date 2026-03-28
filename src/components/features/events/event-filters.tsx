'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FilterChip } from '@/components/shared/filter-chip'
import { STATUS_CONFIG } from '@/components/shared/event-status-badge'
import type { EventStatus } from '@/types/database.types'
import type { EventFilters } from '@/hooks/use-events'
import type { FilterChipColor } from '@/components/shared/filter-chip'

// 'lost' é separado — fica oculto por padrão, exibido como toggle opcional
const MAIN_STATUSES = (Object.keys(STATUS_CONFIG) as EventStatus[]).filter((s) => s !== 'lost')
const LOST_STATUS: EventStatus = 'lost'

const STATUS_COLOR: Record<EventStatus, FilterChipColor> = {
  pending:     'amber',
  confirmed:   'blue',
  preparing:   'purple',
  in_progress: 'brand',
  finished:    'gray',
  post_event:  'gray',
  lost:        'gray',
}

interface EventFiltersProps {
  filters: EventFilters
  onFiltersChange: (filters: EventFilters) => void
}

export function EventFiltersBar({ filters, onFiltersChange }: EventFiltersProps) {
  const [searchInput, setSearchInput] = useState(filters.search ?? '')

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const filtersRef = useRef(filters)
  const onFiltersChangeRef = useRef(onFiltersChange)

  useEffect(() => {
    filtersRef.current = filters
    onFiltersChangeRef.current = onFiltersChange
  })

  useEffect(() => () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
  }, [])

  function handleSearchChange(value: string) {
    setSearchInput(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      onFiltersChangeRef.current({ ...filtersRef.current, search: value || undefined, page: 1 })
    }, 300)
  }

  function handleSearchClear() {
    setSearchInput('')
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    onFiltersChangeRef.current({ ...filtersRef.current, search: undefined, page: 1 })
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
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
          {searchInput && (
            <button
              onClick={handleSearchClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-10 px-3 text-sm shrink-0 gap-1"
            onClick={() => {
              setSearchInput('')
              if (debounceTimer.current) clearTimeout(debounceTimer.current)
              onFiltersChange({ page: 1 })
            }}
          >
            <X className="w-3.5 h-3.5" />
            Limpar
          </Button>
        )}
      </div>

      {/* Linha 2: filtros de status */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Status:
        </span>
        {MAIN_STATUSES.map((status) => (
          <FilterChip
            key={status}
            label={STATUS_CONFIG[status].label}
            active={filters.status?.includes(status) ?? false}
            color={STATUS_COLOR[status]}
            onClick={() => toggleStatus(status)}
          />
        ))}

        {/* Separador + toggle "Perdidos" — oculto por padrão */}
        <span className="w-px h-5 bg-border self-center mx-1" />
        <FilterChip
          label={STATUS_CONFIG[LOST_STATUS].label}
          active={filters.status?.includes(LOST_STATUS) ?? false}
          color={STATUS_COLOR[LOST_STATUS]}
          onClick={() => toggleStatus(LOST_STATUS)}
        />
      </div>
    </div>
  )
}
