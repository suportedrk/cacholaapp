'use client'

import { Users, SearchX } from 'lucide-react'

interface ProviderEmptyStateProps {
  hasFilters: boolean
  onClearFilters?: () => void
  onCreateProvider?: () => void
}

export function ProviderEmptyState({
  hasFilters,
  onClearFilters,
  onCreateProvider,
}: ProviderEmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <SearchX className="w-16 h-16 text-muted-foreground/40 mb-4" aria-hidden="true" />
        <h3 className="text-base font-semibold text-foreground mb-1">
          Nenhum prestador encontrado
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs mb-6">
          Tente ajustar os filtros ou buscar por outro termo.
        </p>
        {onClearFilters && (
          <button
            onClick={onClearFilters}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            Limpar filtros
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <Users className="w-16 h-16 text-muted-foreground/40 mb-4" aria-hidden="true" />
      <h3 className="text-base font-semibold text-foreground mb-1">
        Nenhum prestador cadastrado
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        Cadastre seus DJs, fotógrafos, decoradores e outros fornecedores para gerenciar tudo em um só lugar.
      </p>
      {onCreateProvider && (
        <button
          onClick={onCreateProvider}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          + Cadastrar Primeiro Prestador
        </button>
      )}
    </div>
  )
}
