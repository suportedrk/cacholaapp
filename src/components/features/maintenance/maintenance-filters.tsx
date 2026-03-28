'use client'

import { useRef, useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { FilterChip } from '@/components/shared/filter-chip'
import type { MaintenanceFilters } from '@/hooks/use-maintenance'
import type { MaintenanceType, MaintenanceStatus, MaintenancePriority } from '@/types/database.types'
import type { Sector } from '@/types/database.types'
import type { FilterChipColor } from '@/components/shared/filter-chip'

const TYPE_OPTIONS: { value: MaintenanceType; label: string; color: FilterChipColor }[] = [
  { value: 'emergency', label: 'Emergencial', color: 'red'   },
  { value: 'punctual',  label: 'Pontual',     color: 'amber' },
  { value: 'recurring', label: 'Recorrente',  color: 'brand' },
]

const STATUS_OPTIONS: { value: MaintenanceStatus; label: string; color: FilterChipColor }[] = [
  { value: 'open',          label: 'Aberta',            color: 'blue'   },
  { value: 'in_progress',   label: 'Em Andamento',      color: 'purple' },
  { value: 'waiting_parts', label: 'Aguardando Peças',  color: 'amber'  },
  { value: 'completed',     label: 'Concluída',         color: 'green'  },
]

const PRIORITY_OPTIONS: { value: MaintenancePriority; label: string; color: FilterChipColor }[] = [
  { value: 'critical', label: 'Crítica', color: 'red'   },
  { value: 'high',     label: 'Alta',    color: 'orange' },
  { value: 'medium',   label: 'Média',   color: 'brand'  },
  { value: 'low',      label: 'Baixa',   color: 'gray'   },
]

interface Props {
  filters: MaintenanceFilters
  sectors: Sector[]
  onFiltersChange: (f: MaintenanceFilters) => void
}

export function MaintenanceFilters({ filters, sectors, onFiltersChange }: Props) {
  const [searchInput, setSearchInput] = useState(filters.search ?? '')
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const filtersRef = useRef(filters)
  const onChangeRef = useRef(onFiltersChange)

  useEffect(() => {
    filtersRef.current = filters
    onChangeRef.current = onFiltersChange
  })

  useEffect(() => () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
  }, [])

  function handleSearch(value: string) {
    setSearchInput(value)
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      onChangeRef.current({ ...filtersRef.current, search: value || undefined, page: 1 })
    }, 300)
  }

  function toggleArrayFilter<T extends string>(
    key: 'type' | 'status' | 'priority',
    value: T
  ) {
    const current = (filters[key] ?? []) as T[]
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onFiltersChange({ ...filters, [key]: next.length ? next : undefined, page: 1 })
  }

  function clearAll() {
    setSearchInput('')
    onFiltersChange({ page: 1 })
  }

  const hasFilters =
    filters.search ||
    filters.type?.length ||
    filters.status?.length ||
    filters.priority?.length ||
    filters.sectorId

  return (
    <div className="space-y-3">
      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={searchInput}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar por título, descrição, equipamento..."
          className="pl-9 pr-9"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => handleSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Tipo */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Tipo:</span>
        {TYPE_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            label={opt.label}
            color={opt.color}
            active={filters.type?.includes(opt.value) ?? false}
            onClick={() => toggleArrayFilter('type', opt.value)}
          />
        ))}
      </div>

      {/* Status */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Status:</span>
        {STATUS_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            label={opt.label}
            color={opt.color}
            active={filters.status?.includes(opt.value) ?? false}
            onClick={() => toggleArrayFilter('status', opt.value)}
          />
        ))}
      </div>

      {/* Prioridade + Setor */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Prioridade:</span>
          {PRIORITY_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.value}
              label={opt.label}
              color={opt.color}
              active={filters.priority?.includes(opt.value) ?? false}
              onClick={() => toggleArrayFilter('priority', opt.value)}
            />
          ))}
        </div>

        {sectors.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Setor:</span>
            <Select
              value={filters.sectorId ?? null}
              onValueChange={(v) =>
                onFiltersChange({ ...filters, sectorId: (v && v !== 'all') ? v : undefined, page: 1 })
              }
            >
              <SelectTrigger className="h-8 text-xs w-36">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {sectors.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Limpar filtros */}
      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Limpar filtros
        </button>
      )}
    </div>
  )
}
