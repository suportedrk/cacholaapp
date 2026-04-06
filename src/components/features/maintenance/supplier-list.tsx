'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, Building2, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { FilterChip } from '@/components/shared/filter-chip'
import { EmptyState } from '@/components/shared/empty-state'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { SupplierCard, SupplierCardSkeleton } from './supplier-card'
import { useSuppliers, SUPPLIER_CATEGORIES, type SupplierFilters } from '@/hooks/use-suppliers'

export function SupplierList() {
  const router = useRouter()
  const [filters, setFilters] = useState<SupplierFilters>({ isActive: true })
  const [searchInput, setSearchInput] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const filtersRef  = useRef(filters)

  useEffect(() => { filtersRef.current = filters })
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const { data: suppliers = [], isLoading, isError } = useSuppliers(filters)

  function handleSearch(value: string) {
    setSearchInput(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: value || undefined }))
    }, 300)
  }

  function setActive(val: boolean | undefined) {
    setFilters((f) => ({ ...f, isActive: val }))
  }

  const hasFilters = filters.search || filters.category || filters.isActive !== true

  return (
    <div className="space-y-5">
      {/* ── Header: search + new ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar por razão social ou nome fantasia..."
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
        <Button
          onClick={() => router.push('/manutencao/fornecedores/novo')}
          className="shrink-0 gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Novo Fornecedor</span>
        </Button>
      </div>

      {/* ── Filters ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Category */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Categoria:</span>
          <Select
            value={filters.category ?? null}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, category: v || undefined }))
            }
          >
            <SelectTrigger className="h-8 text-xs w-36">
              {filters.category
                ? <span data-slot="select-value" className="flex flex-1 text-left">{filters.category}</span>
                : <SelectValue placeholder="Todas" />}
            </SelectTrigger>
            <SelectContent>
              {SUPPLIER_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Active/inactive chips */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Status:</span>
          <FilterChip
            label="Ativos"
            color="green"
            active={filters.isActive === true}
            onClick={() => setActive(filters.isActive === true ? undefined : true)}
          />
          <FilterChip
            label="Inativos"
            color="gray"
            active={filters.isActive === false}
            onClick={() => setActive(filters.isActive === false ? undefined : false)}
          />
        </div>

        {/* Clear */}
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setFilters({ isActive: true })
              setSearchInput('')
            }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Limpar
          </button>
        )}
      </div>

      {/* ── Content ──────────────────────────────────────────── */}
      {isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive text-center">
          Erro ao carregar fornecedores. Tente recarregar a página.
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <SupplierCardSkeleton key={i} />)}
        </div>
      ) : suppliers.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nenhum fornecedor cadastrado"
          description="Cadastre empresas que prestam serviço de manutenção para vinculá-las às ordens de serviço."
          action={{
            label: 'Cadastrar Fornecedor',
            onClick: () => router.push('/manutencao/fornecedores/novo'),
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {suppliers.map((s) => <SupplierCard key={s.id} supplier={s} />)}
        </div>
      )}
    </div>
  )
}
