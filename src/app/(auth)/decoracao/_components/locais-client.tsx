'use client'

import { useState } from 'react'
import { RefreshCw, AlertCircle, Plus, Search, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/page-header'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { useDecoracaoLocais } from '@/hooks/use-decoracao-locais'
import type { LocalFiltro } from '@/hooks/use-decoracao-locais'
import { cn } from '@/lib/utils'
import { LocalEditSheet } from './local-edit-sheet'
import type { DecoracaoLocal } from '@/types/decoracao'

const FILTER_OPTIONS: { key: LocalFiltro; label: string }[] = [
  { key: 'ativos', label: 'Ativos' },
  { key: 'inativos', label: 'Inativos' },
  { key: 'todos', label: 'Todos' },
]

export function LocaisClient() {
  const [filtro, setFiltro] = useState<LocalFiltro>('ativos')
  const [search, setSearch] = useState('')
  const [editTarget, setEditTarget] = useState<DecoracaoLocal | null>(null)
  const [createMode, setCreateMode] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const { data: locais = [], isLoading, isError, refetch } = useDecoracaoLocais(filtro)
  const { isTimedOut, retry } = useLoadingTimeout(isLoading)

  const term = search.trim().toLowerCase()
  const filtered = locais.filter((l) => {
    if (!term) return true
    return l.nome.toLowerCase().includes(term)
  })

  function openEdit(l: DecoracaoLocal) {
    setEditTarget(l)
    setCreateMode(false)
    setSheetOpen(true)
  }

  function openCreate() {
    setEditTarget(null)
    setCreateMode(true)
    setSheetOpen(true)
  }

  // ── Skeleton ─────────────────────────────────────────────────
  if (isLoading && !isTimedOut) {
    return (
      <div className="space-y-6">
        <PageHeader title="Locais de guarda" actions={<Button disabled><Plus className="mr-1.5 h-4 w-4" />Novo local</Button>} />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="skeleton-shimmer h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  // ── Erro / Timeout ────────────────────────────────────────────
  if (isError || isTimedOut) {
    return (
      <div className="space-y-6">
        <PageHeader title="Locais de guarda" />
        <div className="flex flex-col items-center gap-3 rounded-lg border border-status-error-border bg-status-error-bg p-8 text-center text-status-error-text">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm font-medium">Erro ao carregar locais.</p>
          <Button variant="outline" size="sm" onClick={() => { void (isTimedOut ? retry() : refetch()) }}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Locais de guarda"
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Novo local
          </Button>
        }
      />

      {/* Filtros + Busca */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Pills de filtro */}
        <div className="flex gap-1.5">
          {FILTER_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setFiltro(key)}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                filtro === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Busca */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <MapPin className="h-10 w-10 opacity-30" />
          <p className="text-sm">
            {search
              ? 'Nenhum local encontrado para essa busca.'
              : filtro === 'inativos'
                ? 'Nenhum local inativo.'
                : 'Nenhum local cadastrado ainda.'}
          </p>
          {!search && filtro === 'ativos' && (
            <Button variant="outline" size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Cadastrar primeiro local
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => openEdit(l)}
                className="w-full rounded-lg border border-border-default bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">{l.nome}</span>
                      {!l.ativo && (
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          Inativo
                        </Badge>
                      )}
                    </div>
                    {l.observacoes && (
                      <p className="truncate pl-5 text-xs text-muted-foreground">{l.observacoes}</p>
                    )}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <LocalEditSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        local={editTarget}
        createMode={createMode}
      />
    </div>
  )
}
