'use client'

import { useRef, useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { MaintenanceFilters } from '@/hooks/use-maintenance'
import type { MaintenanceType, MaintenanceStatus, MaintenancePriority } from '@/types/database.types'
import type { Sector } from '@/types/database.types'

const TYPE_OPTIONS: { value: MaintenanceType; label: string }[] = [
  { value: 'emergency', label: 'Emergencial' },
  { value: 'punctual',  label: 'Pontual' },
  { value: 'recurring', label: 'Recorrente' },
]

const STATUS_OPTIONS: { value: MaintenanceStatus; label: string }[] = [
  { value: 'open',          label: 'Aberta' },
  { value: 'in_progress',   label: 'Em Andamento' },
  { value: 'waiting_parts', label: 'Aguardando Peças' },
  { value: 'completed',     label: 'Concluída' },
]

const PRIORITY_OPTIONS: { value: MaintenancePriority; label: string }[] = [
  { value: 'critical', label: 'Crítica' },
  { value: 'high',     label: 'Alta' },
  { value: 'medium',   label: 'Média' },
  { value: 'low',      label: 'Baixa' },
]

interface Props {
  filters: MaintenanceFilters
  sectors: Sector[]
  onFiltersChange: (f: MaintenanceFilters) => void
}

function PillToggle<T extends string>({
  value,
  active,
  onClick,
  className,
}: {
  value: T
  active: boolean
  onClick: (v: T) => void
  className?: string
} & React.PropsWithChildren) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={cn(
        'px-3 py-1 rounded-full text-xs font-medium transition-all duration-150',
        'border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-card text-muted-foreground border-border hover:border-primary/50',
        className
      )}
    >
      {value}
    </button>
  )
}

export function MaintenanceFilters({ filters, sectors, onFiltersChange }: Props) {
  const [searchInput, setSearchInput] = useState(filters.search ?? '')
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const filtersRef = useRef(filters)
  filtersRef.current = filters
  const onChangeRef = useRef(onFiltersChange)
  onChangeRef.current = onFiltersChange

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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Pills de tipo */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground self-center">Tipo:</span>
        {TYPE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggleArrayFilter('type', opt.value)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 border',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              filters.type?.includes(opt.value)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:border-primary/50'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Pills de status */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-muted-foreground self-center">Status:</span>
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => toggleArrayFilter('status', opt.value)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 border',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              filters.status?.includes(opt.value)
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:border-primary/50'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Prioridade + Setor */}
      <div className="flex flex-wrap gap-3">
        {/* Prioridade pills */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground self-center">Prioridade:</span>
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleArrayFilter('priority', opt.value)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-medium transition-all duration-150 border',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                filters.priority?.includes(opt.value)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:border-primary/50'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Setor select */}
        {sectors.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Setor:</span>
            <select
              value={filters.sectorId ?? ''}
              onChange={(e) => onFiltersChange({ ...filters, sectorId: e.target.value || undefined, page: 1 })}
              className="text-xs border border-border rounded-md px-2 py-1 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos</option>
              {sectors.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
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
