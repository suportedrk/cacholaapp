'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  RefreshCw, AlertCircle, Search, ShieldAlert, Wrench, Trash, CheckCircle2,
  Loader2, Package,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/shared/page-header'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { useQuarentena, useResolverQuarentena } from '@/hooks/use-decoracao'
import { useDecoracaoLocais } from '@/hooks/use-decoracao-locais'
import { cn } from '@/lib/utils'
import type { QuarentenaResumo, QuarentenaStatus, QuarentenaResolucao } from '@/types/decoracao'

type Filtro = QuarentenaStatus | 'todos'

const FILTER_OPTIONS: { key: Filtro; label: string }[] = [
  { key: 'pendente', label: 'Pendentes' },
  { key: 'resolvido', label: 'Resolvidos' },
  { key: 'todos', label: 'Todos' },
]

function variacaoDesc(q: QuarentenaResumo): string {
  const partes = [q.tamanho, q.cor, q.detalhe].filter(Boolean)
  return partes.length ? partes.join(' / ') : q.codigo
}

function formatData(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo',
    }).format(new Date(iso))
  } catch {
    return '—'
  }
}

export function QuarentenaClient() {
  const [filtro, setFiltro] = useState<Filtro>('pendente')
  const [search, setSearch] = useState('')
  const [resolveTarget, setResolveTarget] = useState<QuarentenaResumo | null>(null)

  const { data: linhas = [], isLoading, isError, refetch } = useQuarentena(filtro)
  const { isTimedOut, retry } = useLoadingTimeout(isLoading)

  const term = search.trim().toLowerCase()
  const filtered = useMemo(
    () =>
      linhas.filter((q) => {
        if (!term) return true
        return (
          q.item_nome.toLowerCase().includes(term) ||
          q.codigo.toLowerCase().includes(term) ||
          q.motivo.toLowerCase().includes(term) ||
          (q.origem_festa_label ?? '').toLowerCase().includes(term)
        )
      }),
    [linhas, term],
  )

  // ── Skeleton ─────────────────────────────────────────────────
  if (isLoading && !isTimedOut) {
    return (
      <div className="space-y-6">
        <PageHeader title="Quarentena" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="skeleton-shimmer h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  // ── Erro / Timeout ────────────────────────────────────────────
  if (isError || isTimedOut) {
    return (
      <div className="space-y-6">
        <PageHeader title="Quarentena" />
        <div className="flex flex-col items-center gap-3 rounded-lg border border-status-error-border bg-status-error-bg p-8 text-center text-status-error-text">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm font-medium">Erro ao carregar a quarentena.</p>
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
        title="Quarentena"
        description="Itens da decoração que voltaram das festas para conserto ou reposição."
      />

      {/* Filtros + Busca */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por item, código, motivo, festa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-default py-12 text-center">
          <Package className="h-8 w-8 text-text-tertiary/40" />
          <p className="text-sm text-text-secondary">
            {term
              ? 'Nenhum item corresponde à busca.'
              : filtro === 'pendente'
                ? 'Nenhum item em quarentena pendente. 🎉'
                : 'Nenhum item nesta visão.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((q) => {
            const isPendente = q.status === 'pendente'
            return (
              <li
                key={q.id}
                className="rounded-lg border border-border-default bg-surface-primary p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
                      <p className="truncate text-sm font-medium">
                        {q.item_nome} — {variacaoDesc(q)}
                      </p>
                      <span className="shrink-0 rounded-full badge-amber border px-2 py-0.5 text-xs font-medium">
                        {q.quantidade} {q.quantidade === 1 ? 'peça' : 'peças'}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs text-text-tertiary">{q.codigo}</p>
                    <p className="mt-1.5 text-sm text-text-secondary">{q.motivo}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-tertiary">
                      <span>Local: <strong className="text-text-secondary">{q.local_nome}</strong></span>
                      {q.origem_festa_label && <span>Festa: {q.origem_festa_label}</span>}
                      <span>Entrada: {formatData(q.created_at)}</span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isPendente ? (
                      <Button size="sm" onClick={() => setResolveTarget(q)}>
                        Resolver
                      </Button>
                    ) : (
                      <span
                        className={cn(
                          'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                          q.resolucao === 'consertado'
                            ? 'badge-green border'
                            : 'bg-muted text-text-secondary',
                        )}
                      >
                        {q.resolucao === 'consertado' ? (
                          <><Wrench className="h-3 w-3" /> Consertado</>
                        ) : (
                          <><Trash className="h-3 w-3" /> Descartado</>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {!isPendente && q.resolvido_em && (
                  <p className="mt-2 border-t border-border-default pt-2 text-xs text-text-tertiary">
                    Resolvido em {formatData(q.resolvido_em)}
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <ResolverDialog
        target={resolveTarget}
        onClose={() => setResolveTarget(null)}
      />
    </div>
  )
}

// ── Dialog de resolução ──────────────────────────────────────

function ResolverDialog({
  target,
  onClose,
}: {
  target: QuarentenaResumo | null
  onClose: () => void
}) {
  const { data: locais = [] } = useDecoracaoLocais('ativos')
  const resolver = useResolverQuarentena()
  const [resolucao, setResolucao] = useState<QuarentenaResolucao>('consertado')
  const [localId, setLocalId] = useState<string>('')

  const open = !!target

  // Default do local de devolução = local de origem da quarentena.
  const localDefault = useMemo(() => {
    if (!target) return ''
    return locais.some((l) => l.id === target.local_id)
      ? target.local_id
      : (locais[0]?.id ?? '')
  }, [target, locais])

  // Reseta o desfecho e o local a cada nova linha-alvo.
  const targetId = target?.id ?? null
  useEffect(() => {
    if (!targetId) return
    /* eslint-disable react-hooks/set-state-in-effect -- reset ao abrir nova linha */
    setResolucao('consertado')
    setLocalId('')
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [targetId])

  // Aplica o local default (origem) quando os locais carregam.
  useEffect(() => {
    if (!targetId || localId || !localDefault) return
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- default do local */
    setLocalId(localDefault)
  }, [targetId, localId, localDefault])

  function handleConfirm() {
    if (!target) return
    if (resolucao === 'consertado' && !localId) return
    resolver.mutate(
      {
        id: target.id,
        resolucao,
        localId: resolucao === 'consertado' ? localId : null,
      },
      { onSuccess: onClose },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resolver quarentena</DialogTitle>
          <DialogDescription>
            {target ? `${target.item_nome} — ${variacaoDesc(target)} (${target.quantidade} ${target.quantidade === 1 ? 'peça' : 'peças'})` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Escolha do desfecho */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setResolucao('consertado')}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border p-3 text-sm transition-colors',
                resolucao === 'consertado'
                  ? 'border-primary bg-primary/5 text-text-primary'
                  : 'border-border-default text-text-secondary hover:bg-muted/40',
              )}
            >
              <Wrench className="h-5 w-5" />
              Consertado
              <span className="text-xs text-text-tertiary">Volta ao estoque</span>
            </button>
            <button
              type="button"
              onClick={() => setResolucao('descartado')}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border p-3 text-sm transition-colors',
                resolucao === 'descartado'
                  ? 'border-primary bg-primary/5 text-text-primary'
                  : 'border-border-default text-text-secondary hover:bg-muted/40',
              )}
            >
              <Trash className="h-5 w-5" />
              Descartado
              <span className="text-xs text-text-tertiary">Sai definitivo</span>
            </button>
          </div>

          {/* Local de devolução (só consertado) */}
          {resolucao === 'consertado' && (
            <div className="space-y-1.5">
              <Label>Devolver ao local</Label>
              <Select value={localId} onValueChange={(v) => setLocalId(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {localId
                      ? (locais.find((l) => l.id === localId)?.nome ?? 'Local')
                      : <span className="text-text-tertiary">Selecione o local…</span>}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {locais.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {resolucao === 'consertado' ? (
            <p className="flex items-start gap-1.5 text-xs text-text-tertiary">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
              {target?.quantidade ?? 0} {(target?.quantidade ?? 0) === 1 ? 'peça volta' : 'peças voltam'} ao saldo do local.
            </p>
          ) : (
            <p className="flex items-start gap-1.5 text-xs text-text-tertiary">
              <Trash className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              O saldo segue baixado — a peça não retorna ao estoque.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={resolver.isPending}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={resolver.isPending || (resolucao === 'consertado' && !localId)}
          >
            {resolver.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
