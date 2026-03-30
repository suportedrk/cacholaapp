'use client'

import { useRef } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PROVIDER_STATUS_LABELS } from '@/types/providers'
import type { ProviderFilters, ServiceCategory, ProviderStatus } from '@/types/providers'

interface Props {
  categories: ServiceCategory[]
  filters: ProviderFilters
  onFilterChange: <K extends keyof ProviderFilters>(key: K, value: ProviderFilters[K]) => void
  onReset: () => void
  hasActiveFilters: boolean
  totalCount?: number
}

export function ProviderFiltersBar({
  categories,
  filters,
  onFilterChange,
  onReset,
  hasActiveFilters,
  totalCount,
}: Props) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onFilterChange('search', val)
    }, 300)
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search input */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          defaultValue={filters.search}
          onChange={handleSearchChange}
          placeholder="Buscar por nome ou documento..."
          aria-label="Buscar prestadores"
          className={cn(
            'w-full h-10 pl-9 pr-4 rounded-lg border border-border bg-background',
            'text-sm text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
            'transition-colors',
          )}
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Categoria */}
        <select
          value={filters.category_id}
          onChange={(e) => onFilterChange('category_id', e.target.value)}
          aria-label="Filtrar por categoria"
          className={cn(
            'h-9 pl-3 pr-8 rounded-lg border border-border bg-background',
            'text-sm text-foreground appearance-none cursor-pointer',
            'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
          )}
        >
          <option value="all">Todas categorias</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>

        {/* Status */}
        <select
          value={filters.status}
          onChange={(e) => onFilterChange('status', e.target.value as ProviderStatus | 'all')}
          aria-label="Filtrar por status"
          className={cn(
            'h-9 pl-3 pr-8 rounded-lg border border-border bg-background',
            'text-sm text-foreground appearance-none cursor-pointer',
            'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
          )}
        >
          <option value="all">Todos status</option>
          {(Object.keys(PROVIDER_STATUS_LABELS) as ProviderStatus[]).map((s) => (
            <option key={s} value={s}>
              {PROVIDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        {/* Avaliação mínima */}
        <select
          value={filters.min_rating}
          onChange={(e) => onFilterChange('min_rating', Number(e.target.value))}
          aria-label="Filtrar por avaliação mínima"
          className={cn(
            'h-9 pl-3 pr-8 rounded-lg border border-border bg-background',
            'text-sm text-foreground appearance-none cursor-pointer',
            'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
          )}
        >
          <option value={0}>Qualquer avaliação</option>
          <option value={1}>★ 1+</option>
          <option value={2}>★ 2+</option>
          <option value={3}>★ 3+</option>
          <option value={4}>★ 4+</option>
        </select>

        {/* Limpar filtros */}
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            Limpar filtros
          </button>
        )}

        {/* Count */}
        {totalCount !== undefined && (
          <span className="ml-auto text-xs text-muted-foreground">
            {totalCount} {totalCount === 1 ? 'prestador' : 'prestadores'}
          </span>
        )}
      </div>
    </div>
  )
}
