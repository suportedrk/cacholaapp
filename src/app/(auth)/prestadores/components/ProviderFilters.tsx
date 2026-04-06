'use client'

import { useRef } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
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
        <Select
          value={filters.category_id === 'all' ? null : (filters.category_id || null)}
          onValueChange={(v) => onFilterChange('category_id', v ?? 'all')}
        >
          <SelectTrigger size="sm" className="min-w-[150px]">
            {filters.category_id && filters.category_id !== 'all'
              ? <span data-slot="select-value" className="flex flex-1 text-left">{categories.find((c) => c.id === filters.category_id)?.name ?? 'Categoria'}</span>
              : <SelectValue placeholder="Todas categorias" />}
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status */}
        <Select
          value={filters.status === 'all' ? null : (filters.status || null)}
          onValueChange={(v) => onFilterChange('status', (v ?? 'all') as ProviderStatus | 'all')}
        >
          <SelectTrigger size="sm" className="min-w-[130px]">
            {filters.status && filters.status !== 'all'
              ? <span data-slot="select-value" className="flex flex-1 text-left">{PROVIDER_STATUS_LABELS[filters.status as ProviderStatus]}</span>
              : <SelectValue placeholder="Todos status" />}
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PROVIDER_STATUS_LABELS) as ProviderStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{PROVIDER_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Avaliação mínima */}
        <Select
          value={filters.min_rating === 0 ? null : String(filters.min_rating)}
          onValueChange={(v) => onFilterChange('min_rating', v ? Number(v) : 0)}
        >
          <SelectTrigger size="sm" className="min-w-[150px]">
            {filters.min_rating && filters.min_rating > 0
              ? <span data-slot="select-value" className="flex flex-1 text-left">{'★'.repeat(filters.min_rating)}+</span>
              : <SelectValue placeholder="Qualquer avaliação" />}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">★ 1+</SelectItem>
            <SelectItem value="2">★ 2+</SelectItem>
            <SelectItem value="3">★ 3+</SelectItem>
            <SelectItem value="4">★ 4+</SelectItem>
          </SelectContent>
        </Select>

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
