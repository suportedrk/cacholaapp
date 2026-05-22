'use client'

import { useState } from 'react'
import { Pencil, RefreshCw, AlertCircle, Plus, ImageOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { useForminhaCores } from '@/hooks/use-decoracao'
import { ForminhaColorDot } from './forminha-color-dot'
import { ForminhaEditDialog } from './forminha-edit-dialog'
import type { DecoracaoForminhaCor } from '@/types/decoracao'

const ALL_NUMBERS = Array.from({ length: 26 }, (_, i) => i + 1)

export function ForminhasClient() {
  const { data: cores = [], isLoading, isError } = useForminhaCores()
  const { isTimedOut, retry } = useLoadingTimeout(isLoading)

  const [editTarget, setEditTarget] = useState<DecoracaoForminhaCor | null>(null)
  const [createMode, setCreateMode] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const usedNumbers = new Set(cores.map((c) => c.numero))
  const freeNumbers = ALL_NUMBERS.filter((n) => !usedNumbers.has(n))

  function openEdit(cor: DecoracaoForminhaCor) {
    setEditTarget(cor)
    setCreateMode(false)
    setDialogOpen(true)
  }

  function openCreate() {
    setEditTarget(null)
    setCreateMode(true)
    setDialogOpen(true)
  }

  // ── Loading ──────────────────────────────────────────────────
  if (isLoading && !isTimedOut) {
    return (
      <div className="space-y-6">
        <PageHeader title="Cores de forminhas" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="skeleton-shimmer h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  // ── Error / Timeout ──────────────────────────────────────────
  if (isError || isTimedOut) {
    return (
      <div className="space-y-6">
        <PageHeader title="Cores de forminhas" />
        <div className="flex flex-col items-center gap-3 py-12 text-text-secondary">
          <AlertCircle className="h-8 w-8 text-status-error-text" />
          <p className="text-sm">Erro ao carregar as cores de forminha.</p>
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
          title="Cores de forminhas"
          description="Legenda das 26 cores de forminha — base visual reutilizada nos temas."
          actions={
            freeNumbers.length > 0 ? (
              <Button onClick={openCreate}>
                <Plus className="mr-1.5 h-4 w-4" />
                Nova cor
              </Button>
            ) : undefined
          }
        />

        {/* Empty (defensivo — o catálogo nasce com 26 linhas) */}
        {cores.length === 0 ? (
          <div className="py-12 text-center text-sm text-text-tertiary">
            Nenhuma cor de forminha cadastrada.
          </div>
        ) : (
          <>
            <p className="text-xs text-text-tertiary">
              Bolinhas tracejadas são cores ainda não definidas.
            </p>
            <div className="divide-y divide-border-default overflow-hidden rounded-lg border border-border-default">
              {cores.map((cor) => (
                <div
                  key={cor.id}
                  className="flex items-center gap-3 bg-card px-4 py-3 transition-colors hover:bg-surface-secondary"
                >
                  <ForminhaColorDot
                    corHex={cor.cor_hex}
                    size="md"
                    numero={cor.numero}
                    nome={cor.nome}
                  />
                  <Badge
                    variant="outline"
                    className="badge-gray border font-mono text-xs"
                  >
                    Nº {cor.numero}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-text-primary">
                      {cor.nome}
                    </div>
                    {!cor.cor_hex && (
                      <div className="text-xs text-text-tertiary">Cor não definida</div>
                    )}
                  </div>
                  {!cor.ativo && (
                    <Badge variant="outline" className="badge-gray border text-xs">
                      Inativa
                    </Badge>
                  )}
                  <span className="hidden items-center gap-1 text-xs text-text-tertiary sm:inline-flex">
                    <ImageOff className="h-3.5 w-3.5" />
                    Foto em breve
                  </span>
                  <button
                    onClick={() => openEdit(cor)}
                    aria-label={`Editar forminha Nº ${cor.numero}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <ForminhaEditDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cor={editTarget}
        createMode={createMode}
        freeNumbers={freeNumbers}
      />
    </>
  )
}
