'use client'

import { useRouter } from 'next/navigation'
import { Plus, AlertTriangle } from 'lucide-react'
import { useProviders } from '@/hooks/use-providers'
import { useProviderKpis } from '@/hooks/use-provider-kpis'
import { useServiceCategories } from '@/hooks/use-service-categories'
import { useProviderFiltersStore } from '@/stores/provider-filters-store'
import { ProviderKPICards } from './components/ProviderKPICards'
import { ProviderFiltersBar } from './components/ProviderFilters'
import { ProviderCard } from './components/ProviderCard'
import { ProviderCardSkeleton } from './components/ProviderCardSkeleton'
import { ProviderEmptyState } from './components/ProviderEmptyState'
import { PendingRatingsAlert } from './components/PendingRatingsAlert'

export default function PrestadoresPage() {
  const router = useRouter()

  // ── State ──────────────────────────────────────────────────
  const filters = useProviderFiltersStore((s) => s.filters)
  const setFilter = useProviderFiltersStore((s) => s.setFilter)
  const resetFilters = useProviderFiltersStore((s) => s.resetFilters)
  const hasActiveFilters = useProviderFiltersStore((s) => s.hasActiveFilters)()

  // ── Data ───────────────────────────────────────────────────
  const { data: kpis, isLoading: kpisLoading } = useProviderKpis()
  const { data: categories = [], isLoading: categoriesLoading } = useServiceCategories()
  const {
    data: providers = [],
    isLoading: providersLoading,
    isError,
    refetch,
  } = useProviders(filters)

  // ── Handlers ───────────────────────────────────────────────
  function handleCreateProvider() {
    router.push('/prestadores/novo')
  }

  function handleShowExpiringDocs() {
    setFilter('has_expiring_docs', true)
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Page header ───────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Prestadores de Serviços</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie seus DJs, fotógrafos, decoradores e demais fornecedores
          </p>
        </div>
        <button
          onClick={handleCreateProvider}
          className="shrink-0 inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-all"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Novo Prestador</span>
          <span className="sm:hidden">Novo</span>
        </button>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────── */}
      <ProviderKPICards kpis={kpis} isLoading={kpisLoading} />

      {/* ── Pending ratings alert ─────────────────────────── */}
      {!kpisLoading && (kpis?.pendingRatingsCount ?? 0) > 0 && (
        <PendingRatingsAlert pendingCount={kpis!.pendingRatingsCount} />
      )}

      {/* ── Expiring docs alert ───────────────────────────── */}
      {!kpisLoading && (kpis?.expiringDocsCount ?? 0) > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700/50 p-4 flex items-start gap-3">
          <div className="shrink-0 mt-0.5 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary">
              {kpis!.expiringDocsCount === 1
                ? '1 documento vence nos próximos 30 dias'
                : `${kpis!.expiringDocsCount} documentos vencem nos próximos 30 dias`}
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              Renove os documentos para manter seus prestadores ativos.
            </p>
          </div>
          <button
            onClick={handleShowExpiringDocs}
            className="shrink-0 text-xs font-medium text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 underline underline-offset-2"
          >
            Ver documentos
          </button>
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────── */}
      <ProviderFiltersBar
        categories={categories}
        filters={filters}
        onFilterChange={setFilter}
        onReset={resetFilters}
        hasActiveFilters={hasActiveFilters}
        totalCount={providersLoading ? undefined : providers.length}
      />

      {/* ── Content ───────────────────────────────────────── */}
      {isError ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <p className="text-sm text-muted-foreground">
            Erro ao carregar prestadores. Verifique sua conexão.
          </p>
          <button
            onClick={() => refetch()}
            className="text-sm text-primary hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      ) : providersLoading || categoriesLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProviderCardSkeleton key={i} />
          ))}
        </div>
      ) : providers.length === 0 ? (
        <ProviderEmptyState
          hasFilters={hasActiveFilters}
          onClearFilters={resetFilters}
          onCreateProvider={handleCreateProvider}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((provider, i) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              animationDelay={Math.min(i * 40, 200)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
