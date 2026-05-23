'use client'

import { useState } from 'react'
import { RefreshCw, AlertCircle, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { useDecoracaoTemas, useForminhaCores } from '@/hooks/use-decoracao'
import { useSignedUrls } from '@/hooks/use-signed-urls'
import { DECORACAO_BUCKETS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { TemaCard } from './tema-card'
import { TemaEditSheet } from './tema-edit-sheet'
import type { DecoracaoTemaComForminhas } from '@/types/decoracao'

type FilterKey = 'all' | 'active' | 'inactive'

const FILTER_LABELS: Record<FilterKey, string> = {
  all: 'Todos',
  active: 'Ativos',
  inactive: 'Inativos',
}

export function TemasClient() {
  const { data: temas = [], isLoading, isError } = useDecoracaoTemas()
  const { data: forminhas = [] } = useForminhaCores()
  const { isTimedOut, retry } = useLoadingTimeout(isLoading)

  const fotoPaths = temas.map((t) => t.foto_url).filter((p): p is string => p !== null)
  const { data: signedUrls = {} } = useSignedUrls(DECORACAO_BUCKETS.temas, fotoPaths)

  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [editTarget, setEditTarget] = useState<DecoracaoTemaComForminhas | null>(null)
  const [createMode, setCreateMode] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const term = search.trim().toLowerCase()
  const filtered = temas.filter((t) => {
    if (filter === 'active' && !t.ativo) return false
    if (filter === 'inactive' && t.ativo) return false
    if (term && !t.nome.toLowerCase().includes(term)) return false
    return true
  })

  function openEdit(tema: DecoracaoTemaComForminhas) {
    setEditTarget(tema)
    setCreateMode(false)
    setSheetOpen(true)
  }

  function openCreate() {
    setEditTarget(null)
    setCreateMode(true)
    setSheetOpen(true)
  }

  // ── Loading ──────────────────────────────────────────────────
  if (isLoading && !isTimedOut) {
    return (
      <div className="space-y-6">
        <PageHeader title="Temas" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="skeleton-shimmer h-52 w-full rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // ── Error / Timeout ──────────────────────────────────────────
  if (isError || isTimedOut) {
    return (
      <div className="space-y-6">
        <PageHeader title="Temas" />
        <div className="flex flex-col items-center gap-3 py-12 text-text-secondary">
          <AlertCircle className="h-8 w-8 text-status-error-text" />
          <p className="text-sm">Erro ao carregar os temas.</p>
          <Button variant="outline" size="sm" onClick={retry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Temas"
          description="Catálogo de temas de festa e suas cores de forminha."
          actions={
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Novo tema
            </Button>
          }
        />

        {/* Filtros */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(FILTER_LABELS) as FilterKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                  filter === key
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-surface-secondary text-text-secondary hover:bg-surface-tertiary',
                )}
              >
                {FILTER_LABELS[key]}
              </button>
            ))}
          </div>
          <div className="relative sm:w-64">
            <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tema…"
              className="pl-8"
            />
          </div>
        </div>

        {/* Catálogo */}
        {temas.length === 0 ? (
          <div className="py-12 text-center text-sm text-text-tertiary">
            Nenhum tema cadastrado.
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-text-tertiary">
            Nenhum tema encontrado para os filtros aplicados.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((tema) => (
              <TemaCard
                key={tema.id}
                tema={tema}
                signedUrl={tema.foto_url ? signedUrls[tema.foto_url] : undefined}
                onClick={() => openEdit(tema)}
              />
            ))}
          </div>
        )}
      </div>

      <TemaEditSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        tema={editTarget}
        createMode={createMode}
        allForminhas={forminhas}
      />
    </>
  )
}
