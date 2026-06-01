'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Plus,
  RefreshCw,
  AlertCircle,
  Truck,
  ArrowRight,
  Inbox,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { useTransferencias } from '@/hooks/use-decoracao-transferencias'
import { ROUTES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { TransferenciaStatus } from '@/types/decoracao'
import { TransferenciaStatusBadge } from './transferencia-status-badge'
import {
  NovaTransferenciaSheet,
  type NovaTransferenciaSeed,
} from './nova-transferencia-sheet'
import { SugerirPelaFestaSheet } from './sugerir-pela-festa-sheet'

type StatusFilter = TransferenciaStatus | 'todas'

const FILTROS: { value: StatusFilter; label: string }[] = [
  { value: 'em_transito', label: 'Em trânsito' },
  { value: 'recebida', label: 'Recebidas' },
  { value: 'cancelada', label: 'Canceladas' },
  { value: 'todas', label: 'Todas' },
]

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return '—'
  }
}

export function TransferenciasClient() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('em_transito')
  const [novaOpen, setNovaOpen] = useState(false)
  const [sugerirOpen, setSugerirOpen] = useState(false)
  // Seed da sugestão + counter para forçar remount da NovaTransferenciaSheet
  // (key-remount: estado inicial relê o seed sem effect-hydration).
  const [seed, setSeed] = useState<NovaTransferenciaSeed | undefined>(undefined)
  const [seedKey, setSeedKey] = useState(0)

  function handleCriarComSugestao(s: NovaTransferenciaSeed) {
    setSugerirOpen(false)
    setSeed(s)
    setSeedKey((k) => k + 1)
    setNovaOpen(true)
  }

  // Abrir "Nova transferência" vazia: limpa seed e força remount limpo.
  function handleNovaVazia() {
    setSeed(undefined)
    setSeedKey((k) => k + 1)
    setNovaOpen(true)
  }

  const {
    data: transferencias = [],
    isLoading,
    isError,
    refetch,
  } = useTransferencias(statusFilter)

  const { isTimedOut, retry } = useLoadingTimeout(isLoading)

  // ── Skeleton ─────────────────────────────────────────────────
  if (isLoading && !isTimedOut) {
    return (
      <div className="space-y-6">
        <PageHeader title="Transferências" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="skeleton-shimmer h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  // ── Erro ─────────────────────────────────────────────────────
  if (isError || isTimedOut) {
    return (
      <div className="space-y-6">
        <PageHeader title="Transferências" />
        <div className="flex flex-col items-center gap-3 rounded-lg border border-status-error-border bg-status-error-bg p-8 text-center text-status-error-text">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm font-medium">Erro ao carregar transferências.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void (isTimedOut ? retry() : refetch())}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  // ── OK ───────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title="Transferências"
        description="Movimentações de peças entre locais de guarda."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setSugerirOpen(true)}>
              <Sparkles className="mr-1.5 h-4 w-4" />
              Sugerir pela festa
            </Button>
            <Button onClick={handleNovaVazia}>
              <Plus className="mr-1.5 h-4 w-4" />
              Nova transferência
            </Button>
          </div>
        }
      />

      {/* Filtro de status — pills */}
      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              statusFilter === f.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-surface-primary text-text-secondary hover:bg-surface-secondary',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {transferencias.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <Inbox className="h-10 w-10 opacity-30" />
          <p className="text-sm">
            {statusFilter === 'em_transito'
              ? 'Nenhuma transferência em trânsito.'
              : statusFilter === 'todas'
              ? 'Nenhuma transferência registrada ainda.'
              : `Nenhuma transferência ${statusFilter === 'recebida' ? 'recebida' : 'cancelada'}.`}
          </p>
          {statusFilter === 'em_transito' && (
            <Button variant="outline" size="sm" onClick={handleNovaVazia}>
              <Plus className="mr-1.5 h-4 w-4" />
              Lançar nova
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {transferencias.map((t) => (
            <li key={t.id}>
              <Link
                href={`${ROUTES.decoracaoTransferencias}/${t.id}`}
                className="card-interactive flex flex-col gap-3 rounded-lg border bg-surface-primary p-4 md:flex-row md:items-center md:gap-6"
              >
                {/* Origem → Destino */}
                <div className="flex flex-1 items-center gap-2 text-sm font-medium">
                  <Truck className="h-4 w-4 text-text-tertiary" />
                  <span>{t.origem_nome}</span>
                  <ArrowRight className="h-4 w-4 text-text-tertiary" />
                  <span>{t.destino_nome}</span>
                </div>

                {/* Status */}
                <TransferenciaStatusBadge status={t.status} />

                {/* Metadados */}
                <div className="flex flex-col gap-0.5 text-xs text-text-secondary md:items-end">
                  <span>
                    {formatDate(t.data_envio)} · {t.itens_count}{' '}
                    {t.itens_count === 1 ? 'item' : 'itens'}
                  </span>
                  {t.created_by_nome && (
                    <span className="text-text-tertiary">por {t.created_by_nome}</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <NovaTransferenciaSheet
        key={seedKey}
        open={novaOpen}
        onOpenChange={setNovaOpen}
        initialSeed={seed}
      />

      <SugerirPelaFestaSheet
        open={sugerirOpen}
        onOpenChange={setSugerirOpen}
        onCriarTransferencia={handleCriarComSugestao}
      />
    </div>
  )
}
