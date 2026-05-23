'use client'

import { useState } from 'react'
import { RefreshCw, AlertCircle, Plus, Search, Wind, ImageOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { useBalaoModelos } from '@/hooks/use-decoracao'
import { useSignedUrls } from '@/hooks/use-signed-urls'
import { DECORACAO_BUCKETS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { BalaoEditSheet } from './balao-edit-sheet'
import type { DecoracaoBalaoModelo } from '@/types/decoracao'

type FilterKey = 'all' | 'active' | 'inactive'

const FILTER_LABELS: Record<FilterKey, string> = {
  all: 'Todos',
  active: 'Ativos',
  inactive: 'Inativos',
}

function formatBRL(v: number | null): string {
  if (v === null) return '—'
  return v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  })
}

export function BaloesClient() {
  const { data: modelos = [], isLoading, isError, refetch } = useBalaoModelos()
  const { isTimedOut, retry } = useLoadingTimeout(isLoading)

  const fotoPaths = modelos.map((m) => m.foto_url).filter((p): p is string => p !== null)
  const { data: signedUrls = {} } = useSignedUrls(DECORACAO_BUCKETS.baloes, fotoPaths)

  const [filter, setFilter] = useState<FilterKey>('all')
  const [search, setSearch] = useState('')
  const [editTarget, setEditTarget] = useState<DecoracaoBalaoModelo | null>(null)
  const [createMode, setCreateMode] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  const term = search.trim().toLowerCase()
  const filtered = modelos.filter((m) => {
    if (filter === 'active' && !m.ativo) return false
    if (filter === 'inactive' && m.ativo) return false
    if (term && !m.nome.toLowerCase().includes(term)) return false
    return true
  })

  function openEdit(modelo: DecoracaoBalaoModelo) {
    setEditTarget(modelo)
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
        <PageHeader title="Balões" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="skeleton-shimmer h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  // ── Error / timeout ──────────────────────────────────────────
  if (isError || isTimedOut) {
    return (
      <div className="space-y-6">
        <PageHeader title="Balões" />
        <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">Erro ao carregar modelos de balão.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { void retry?.(); void refetch() }}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Balões"
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Novo modelo
          </Button>
        }
      />

      {/* Filtros + busca */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1.5">
          {(Object.entries(FILTER_LABELS) as [FilterKey, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                filter === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar modelo…"
            className="pl-8"
          />
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <Wind className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhum modelo encontrado.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-medium">Modelo</th>
                <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Custo</th>
                <th className="px-4 py-2.5 text-right font-medium">Venda</th>
                <th className="px-4 py-2.5 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, idx) => (
                <tr
                  key={m.id}
                  onClick={() => openEdit(m)}
                  className={cn(
                    'cursor-pointer transition-colors hover:bg-muted/50',
                    idx < filtered.length - 1 && 'border-b',
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {m.foto_url && signedUrls[m.foto_url] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={signedUrls[m.foto_url]}
                          alt={m.nome}
                          className="h-8 w-10 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-8 w-10 shrink-0 items-center justify-center rounded bg-muted">
                          <ImageOff className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <span className="font-medium">{m.nome}</span>
                        {m.categoria && (
                          <span className="ml-2 text-xs text-muted-foreground">{m.categoria}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">
                    {formatBRL(m.custo)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium">
                    {formatBRL(m.valor_venda)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
                        m.ativo ? 'badge-green' : 'badge-gray',
                      )}
                    >
                      {m.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BalaoEditSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        modelo={editTarget}
        createMode={createMode}
      />
    </div>
  )
}
