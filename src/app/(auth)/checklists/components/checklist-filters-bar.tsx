'use client'

import { useCallback, useEffect, useRef, Suspense } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { FilterChip } from '@/components/shared/filter-chip'
import { useChecklistCategories } from '@/hooks/use-checklists'
import { cn } from '@/lib/utils'
import type { ChecklistStatus, ChecklistType, Priority } from '@/types/database.types'
import type { FilterChipColor } from '@/components/shared/filter-chip'

// ─────────────────────────────────────────────────────────────
// OPÇÕES DE FILTRO
// ─────────────────────────────────────────────────────────────
const STATUS_OPTIONS: { value: ChecklistStatus; label: string; color: FilterChipColor }[] = [
  { value: 'pending',     label: 'Pendente',      color: 'amber' },
  { value: 'in_progress', label: 'Em Andamento',  color: 'blue'  },
  { value: 'completed',   label: 'Concluído',     color: 'green' },
  { value: 'cancelled',   label: 'Cancelado',     color: 'gray'  },
]

const TYPE_OPTIONS: { value: ChecklistType; label: string; color: FilterChipColor }[] = [
  { value: 'event',      label: 'Evento',      color: 'blue'   },
  { value: 'standalone', label: 'Avulso',      color: 'gray'   },
  { value: 'recurring',  label: 'Recorrente',  color: 'purple' },
]

const PRIORITY_OPTIONS: { value: Priority; label: string; color: FilterChipColor }[] = [
  { value: 'urgent', label: 'Urgente', color: 'red'    },
  { value: 'high',   label: 'Alta',    color: 'orange' },
  { value: 'medium', label: 'Média',   color: 'amber'  },
  { value: 'low',    label: 'Baixa',   color: 'green'  },
]

// ─────────────────────────────────────────────────────────────
// HELPER: ler/escrever params na URL
// ─────────────────────────────────────────────────────────────
function useFiltersFromUrl() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const push = useCallback(
    (updates: Record<string, string | string[] | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, val] of Object.entries(updates)) {
        if (val === null || val === '' || (Array.isArray(val) && val.length === 0)) {
          params.delete(key)
        } else if (Array.isArray(val)) {
          params.set(key, val.join(','))
        } else {
          params.set(key, val)
        }
      }
      // reset page ao filtrar
      params.delete('page')
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [searchParams, router, pathname],
  )

  return {
    q:          searchParams.get('q') ?? '',
    statuses:   (searchParams.get('status') ?? '').split(',').filter(Boolean) as ChecklistStatus[],
    type:       (searchParams.get('type') ?? '') as ChecklistType | '',
    priority:   (searchParams.get('priority') ?? '') as Priority | '',
    categoryId: searchParams.get('categoryId') ?? '',
    overdue:    searchParams.get('overdue') === '1',
    push,
  }
}

// ─────────────────────────────────────────────────────────────
// INNER COMPONENT (usa useSearchParams — precisa de Suspense no pai)
// ─────────────────────────────────────────────────────────────
function ChecklistFiltersBarInner() {
  const { q, statuses, type, priority, categoryId, overdue, push } = useFiltersFromUrl()
  const { data: categories = [] } = useChecklistCategories()

  // Debounce para campo de busca
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSearch = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => push({ q: value || null }), 300)
    },
    [push],
  )

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const hasFilters = !!(q || statuses.length || type || priority || categoryId || overdue)

  function clearAll() {
    if (inputRef.current) inputRef.current.value = ''
    push({ q: null, status: null, type: null, priority: null, categoryId: null, overdue: null })
  }

  function toggleStatus(s: ChecklistStatus) {
    const next = statuses.includes(s)
      ? statuses.filter((x) => x !== s)
      : [...statuses, s]
    push({ status: next })
  }

  return (
    <div className="space-y-3">
      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          defaultValue={q}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar checklists…"
          className={cn(
            'w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-background',
            'text-sm placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent',
            'transition-colors hover:border-border-strong',
          )}
        />
      </div>

      {/* Status chips */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground shrink-0 w-16">Status:</span>
        {STATUS_OPTIONS.map(({ value, label, color }) => (
          <FilterChip
            key={value}
            label={label}
            color={color}
            active={statuses.includes(value)}
            onClick={() => toggleStatus(value)}
          />
        ))}
      </div>

      {/* Tipo + Prioridade */}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground shrink-0 w-16">Tipo:</span>
          {TYPE_OPTIONS.map(({ value, label, color }) => (
            <FilterChip
              key={value}
              label={label}
              color={color}
              active={type === value}
              onClick={() => push({ type: type === value ? null : value })}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-muted-foreground shrink-0 w-16">Prioridade:</span>
          {PRIORITY_OPTIONS.map(({ value, label, color }) => (
            <FilterChip
              key={value}
              label={label}
              color={color}
              active={priority === value}
              onClick={() => push({ priority: priority === value ? null : value })}
            />
          ))}
        </div>
      </div>

      {/* Categoria + Overdue */}
      <div className="flex flex-wrap gap-2 items-center">
        {categories.length > 0 && (
          <>
            <span className="text-xs text-muted-foreground shrink-0 w-16">Categoria:</span>
            {categories.map((cat) => (
              <FilterChip
                key={cat.id}
                label={cat.name}
                color="gray"
                active={categoryId === cat.id}
                onClick={() => push({ categoryId: categoryId === cat.id ? null : cat.id })}
              />
            ))}
            <span className="w-px h-4 bg-border mx-1 self-center" />
          </>
        )}

        <FilterChip
          label="Atrasados"
          color="red"
          active={overdue}
          onClick={() => push({ overdue: overdue ? null : '1' })}
        />
      </div>

      {/* Limpar filtros */}
      {hasFilters && (
        <button
          onClick={clearAll}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-3 h-3" />
          Limpar filtros
        </button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// EXPORT: com Suspense (useSearchParams obriga Suspense no Next.js 15+)
// ─────────────────────────────────────────────────────────────
function FiltersSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-10 bg-muted rounded-lg w-full" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-7 w-20 bg-muted rounded-full" />
        ))}
      </div>
    </div>
  )
}

export function ChecklistFiltersBar() {
  return (
    <Suspense fallback={<FiltersSkeleton />}>
      <ChecklistFiltersBarInner />
    </Suspense>
  )
}

// ─────────────────────────────────────────────────────────────
// HOOK: lê os filtros da URL (para o page.tsx consumir)
// ─────────────────────────────────────────────────────────────
function useChecklistUrlFiltersInner() {
  const searchParams = useSearchParams()
  return {
    q:          searchParams.get('q') ?? undefined,
    statuses:   (searchParams.get('status') ?? '').split(',').filter(Boolean) as ChecklistStatus[],
    type:       (searchParams.get('type') ?? '') as ChecklistType | '',
    priority:   (searchParams.get('priority') ?? '') as Priority | '',
    categoryId: searchParams.get('categoryId') ?? undefined,
    overdue:    searchParams.get('overdue') === '1' || undefined,
    page:       Number(searchParams.get('page') ?? '1'),
  }
}

export function useChecklistUrlFilters() {
  // Wrapper — chamado dentro de Suspense pelo page.tsx
  return useChecklistUrlFiltersInner()
}
