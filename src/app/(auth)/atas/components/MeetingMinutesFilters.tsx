'use client'

import { useRef } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { MEETING_STATUS_LABELS } from '@/types/minutes'
import type { MeetingMinutesFilters, MeetingStatus } from '@/types/minutes'

const PERIOD_LABELS: Record<string, string> = {
  '1':  'Último mês',
  '3':  'Últimos 3 meses',
  '6':  'Últimos 6 meses',
  '12': 'Último ano',
  'all': 'Todos os períodos',
}

interface Props {
  filters: MeetingMinutesFilters
  onFilterChange: <K extends keyof MeetingMinutesFilters>(key: K, value: MeetingMinutesFilters[K]) => void
  onReset: () => void
  hasActiveFilters: boolean
  totalCount?: number
  showOnlyMine?: boolean
}

export function MeetingMinutesFiltersBar({
  filters,
  onFilterChange,
  onReset,
  hasActiveFilters,
  totalCount,
  showOnlyMine = false,
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
      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          defaultValue={filters.search}
          onChange={handleSearchChange}
          placeholder="Buscar por título ou local..."
          aria-label="Buscar atas"
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
        {/* Status */}
        <Select
          value={filters.status === 'all' ? null : (filters.status || null)}
          onValueChange={(v) => onFilterChange('status', (v ?? 'all') as MeetingStatus | 'all')}
        >
          <SelectTrigger size="sm" className="min-w-[130px]">
            {filters.status && filters.status !== 'all'
              ? <span data-slot="select-value" className="flex flex-1 text-left">{MEETING_STATUS_LABELS[filters.status as MeetingStatus]}</span>
              : <SelectValue placeholder="Todos status" />}
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(MEETING_STATUS_LABELS) as MeetingStatus[]).map((s) => (
              <SelectItem key={s} value={s}>{MEETING_STATUS_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Período */}
        <Select
          value={filters.period}
          onValueChange={(v) => onFilterChange('period', v as MeetingMinutesFilters['period'])}
        >
          <SelectTrigger size="sm" className="min-w-[160px]">
            <SelectValue>{PERIOD_LABELS[filters.period] ?? 'Período'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(PERIOD_LABELS)).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Somente as minhas */}
        {showOnlyMine && (
          <button
            type="button"
            onClick={() => onFilterChange('onlyMine', !filters.onlyMine)}
            className={cn(
              'inline-flex items-center h-9 px-3 rounded-lg border text-sm transition-colors',
              filters.onlyMine
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            Minhas atas
          </button>
        )}

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

        {/* Contagem */}
        {totalCount !== undefined && (
          <span className="ml-auto text-xs text-muted-foreground">
            {totalCount} {totalCount === 1 ? 'ata' : 'atas'}
          </span>
        )}
      </div>
    </div>
  )
}
