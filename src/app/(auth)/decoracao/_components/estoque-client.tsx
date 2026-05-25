'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  RefreshCw,
  AlertCircle,
  Search,
  Warehouse,
  Check,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import {
  useDecoracaoEstoque,
  useDecoracaoItensParaEstoque,
  useUpsertEstoqueSaldo,
} from '@/hooks/use-decoracao-estoque'
import { useDecoracaoLocais } from '@/hooks/use-decoracao-locais'
import { ROUTES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { DecoracaoItemVariacao } from '@/types/decoracao'

// ─── helper: label descritivo da variação ────────────────────────────────────

function variacaoLabel(
  v: Pick<DecoracaoItemVariacao, 'tamanho' | 'cor' | 'detalhe' | 'codigo'>,
): string {
  const partes = [v.tamanho, v.cor, v.detalhe].filter(Boolean)
  return partes.length ? partes.join(' / ') : v.codigo
}

// ─── célula editável de quantidade ───────────────────────────────────────────

interface QuantidadeCelulaProps {
  variacaoId: string
  localId: string
  initial: number
  isTableCell?: boolean
}

function QuantidadeCelula({
  variacaoId,
  localId,
  initial,
  isTableCell = true,
}: QuantidadeCelulaProps) {
  const [value, setValue] = useState(String(initial))
  const [estado, setEstado] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')
  const prevRef = useRef(initial)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { mutateAsync: upsert } = useUpsertEstoqueSaldo()

  // Sincroniza com cache externo quando o valor inicial muda (sem substituir edições ativas)
  useEffect(() => {
    if (estado === 'idle' || estado === 'saved') {
      setValue(String(initial))
      prevRef.current = initial
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial])

  const handleBlur = useCallback(async () => {
    const num = parseInt(value, 10)
    const quantidade = isNaN(num) || num < 0 ? 0 : num

    if (quantidade === prevRef.current) {
      setValue(String(prevRef.current))
      return
    }

    setEstado('saving')
    setErrMsg('')

    try {
      await upsert({ variacao_id: variacaoId, local_id: localId, quantidade })
      prevRef.current = quantidade
      setValue(String(quantidade))
      setEstado('saved')
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setEstado('idle'), 2000)
    } catch (err: unknown) {
      // Reverte para o valor anterior — não dá falsa impressão de salvo
      setValue(String(prevRef.current))
      const msg = err instanceof Error ? err.message : 'Erro ao salvar'
      setErrMsg(msg)
      setEstado('error')
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setEstado('idle'), 4000)
    }
  }, [value, variacaoId, localId, upsert, estado])

  const inputEl = (
    <div className="relative flex items-center justify-center gap-1">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => void handleBlur()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
        disabled={estado === 'saving'}
        className={cn(
          'w-16 rounded border px-2 py-0.5 text-center text-sm focus:outline-none focus:ring-1',
          estado === 'error'
            ? 'border-status-error-border bg-status-error-bg text-status-error-text focus:ring-red-400'
            : estado === 'saved'
              ? 'border-green-400 bg-green-50 dark:bg-green-950 focus:ring-green-400'
              : 'border-border-default bg-card focus:ring-primary',
          estado === 'saving' && 'opacity-50',
        )}
        title={estado === 'error' ? errMsg : undefined}
        aria-label={estado === 'error' ? `Erro: ${errMsg}` : undefined}
      />
      {estado === 'saved' && (
        <Check className="h-3.5 w-3.5 shrink-0 text-green-600" aria-hidden />
      )}
      {estado === 'error' && (
        <AlertTriangle
          className="h-3.5 w-3.5 shrink-0 text-status-error-text"
          aria-label={errMsg}
        />
      )}
    </div>
  )

  if (!isTableCell) return inputEl

  return (
    <td className="border border-border-default px-2 py-1 text-center align-middle">
      {inputEl}
    </td>
  )
}

// ─── vista mobile — card por variação ────────────────────────────────────────

interface VariacaoCardMobileProps {
  itemNome: string
  variacao: Pick<DecoracaoItemVariacao, 'id' | 'tamanho' | 'cor' | 'detalhe' | 'codigo'>
  locais: { id: string; nome: string }[]
  todosLocais: { id: string; nome: string }[]
  saldoMap: Map<string, Map<string, number>>
}

function VariacaoCardMobile({ itemNome, variacao, locais, todosLocais, saldoMap }: VariacaoCardMobileProps) {
  const saldosV = saldoMap.get(variacao.id)
  // Total considera TODOS os locais (não só os visíveis no filtro)
  const total = todosLocais.reduce((acc, l) => acc + (saldosV?.get(l.id) ?? 0), 0)

  return (
    <div className="rounded-lg border border-border-default bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{itemNome}</p>
          <p className="text-sm font-medium">{variacaoLabel(variacao)}</p>
          <p className="text-xs font-mono text-muted-foreground">{variacao.codigo}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-lg font-bold tabular-nums">{total}</p>
        </div>
      </div>
      <div className="space-y-2">
        {locais.map((local) => (
          <div key={local.id} className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{local.nome}</span>
            <QuantidadeCelula
              variacaoId={variacao.id}
              localId={local.id}
              initial={saldosV?.get(local.id) ?? 0}
              isTableCell={false}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── componente principal ─────────────────────────────────────────────────────

export function EstoqueClient() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [localFiltro, setLocalFiltro] = useState<string | null>(null)

  const {
    data: saldos = [],
    isLoading: loadingSaldos,
    isError: errorSaldos,
    refetch: refetchSaldos,
  } = useDecoracaoEstoque()

  const {
    data: locaisData = [],
    isLoading: loadingLocais,
    isError: errorLocais,
  } = useDecoracaoLocais('ativos')

  const {
    data: itensData = [],
    isLoading: loadingItens,
    isError: errorItens,
  } = useDecoracaoItensParaEstoque()

  const isLoading = loadingSaldos || loadingLocais || loadingItens
  const isError = errorSaldos || errorLocais || errorItens
  const { isTimedOut, retry } = useLoadingTimeout(isLoading)

  // Mapa variacao_id → local_id → quantidade para lookup O(1)
  const saldoMap = new Map<string, Map<string, number>>()
  for (const s of saldos) {
    if (!saldoMap.has(s.variacao_id)) saldoMap.set(s.variacao_id, new Map())
    saldoMap.get(s.variacao_id)!.set(s.local_id, s.quantidade)
  }

  // Locais visíveis na tabela (todos ou só o filtrado)
  const locaisVisiveis = localFiltro
    ? locaisData.filter((l) => l.id === localFiltro)
    : locaisData

  // Filtro de busca por nome de item ou variação
  const term = search.trim().toLowerCase()
  const itensFiltrados = itensData.filter((item) => {
    if (!term) return true
    if (item.nome.toLowerCase().includes(term)) return true
    return item.variacoes.some((v) =>
      [v.tamanho, v.cor, v.detalhe, v.codigo]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(term)),
    )
  })

  // ── Skeleton ──────────────────────────────────────────────────

  if (isLoading && !isTimedOut) {
    return (
      <div className="space-y-6">
        <PageHeader title="Estoque" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="skeleton-shimmer h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  // ── Erro / Timeout ────────────────────────────────────────────

  if (isError || isTimedOut) {
    return (
      <div className="space-y-6">
        <PageHeader title="Estoque" />
        <div className="flex flex-col items-center gap-3 rounded-lg border border-status-error-border bg-status-error-bg p-8 text-center text-status-error-text">
          <AlertCircle className="h-8 w-8" />
          <p className="text-sm font-medium">Erro ao carregar estoque.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void (isTimedOut ? retry() : refetchSaldos())}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  // ── Empty — sem locais ────────────────────────────────────────

  if (locaisData.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Estoque" />
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <Warehouse className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhum local de guarda ativo cadastrado.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(ROUTES.decoracaoLocais)}
          >
            Cadastrar locais
          </Button>
        </div>
      </div>
    )
  }

  // ── Empty — sem itens ─────────────────────────────────────────

  if (itensData.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Estoque" />
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <Warehouse className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhum item de decoração ativo cadastrado.</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(ROUTES.decoracaoItens)}
          >
            Cadastrar itens
          </Button>
        </div>
      </div>
    )
  }

  // ── Render principal ──────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader title="Estoque" />

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Pills de local */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setLocalFiltro(null)}
            className={cn(
              'rounded-full px-3 py-1 text-sm font-medium transition-colors',
              localFiltro === null
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80',
            )}
          >
            Todos os locais
          </button>
          {locaisData.map((local) => (
            <button
              key={local.id}
              type="button"
              onClick={() => setLocalFiltro(local.id === localFiltro ? null : local.id)}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                localFiltro === local.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              {local.nome}
            </button>
          ))}
        </div>

        {/* Busca */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar item ou variação…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Empty state de busca */}
      {itensFiltrados.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <Search className="h-10 w-10 opacity-30" />
          <p className="text-sm">Nenhum item encontrado para essa busca.</p>
        </div>
      )}

      {itensFiltrados.length > 0 && (
        <>
          {/* ── Desktop: tabela variações × locais ── */}
          <div className="hidden overflow-x-auto rounded-lg border border-border-default md:block">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border border-border-default px-3 py-2 text-left font-medium text-muted-foreground min-w-[200px]">
                    Variação
                  </th>
                  {locaisVisiveis.map((local) => (
                    <th
                      key={local.id}
                      className="border border-border-default px-3 py-2 text-center font-medium text-muted-foreground whitespace-nowrap"
                    >
                      {local.nome}
                    </th>
                  ))}
                  <th className="border border-border-default px-3 py-2 text-center font-medium text-muted-foreground">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {itensFiltrados.map((item) =>
                  item.variacoes.map((v, vIdx) => {
                    const saldosV = saldoMap.get(v.id)
                    // Total considera TODOS os locais (não só os visíveis no filtro)
                    const total = locaisData.reduce(
                      (acc, l) => acc + (saldosV?.get(l.id) ?? 0),
                      0,
                    )

                    return (
                      <tr key={v.id} className="hover:bg-muted/20">
                        <td className="border border-border-default px-3 py-1.5 align-middle">
                          {vIdx === 0 && (
                            <p className="text-xs font-semibold text-text-primary mb-0.5">
                              {item.nome}
                            </p>
                          )}
                          <p className="text-sm">{variacaoLabel(v)}</p>
                          <p className="text-xs font-mono text-muted-foreground">{v.codigo}</p>
                        </td>

                        {locaisVisiveis.map((local) => (
                          <QuantidadeCelula
                            key={`${v.id}-${local.id}`}
                            variacaoId={v.id}
                            localId={local.id}
                            initial={saldosV?.get(local.id) ?? 0}
                          />
                        ))}

                        <td className="border border-border-default px-3 py-1.5 text-center align-middle font-semibold tabular-nums">
                          {total}
                        </td>
                      </tr>
                    )
                  }),
                )}
              </tbody>
            </table>
          </div>

          {/* ── Mobile: cards por variação ── */}
          <div className="space-y-3 md:hidden">
            {itensFiltrados.map((item) =>
              item.variacoes.map((v) => (
                <VariacaoCardMobile
                  key={v.id}
                  itemNome={item.nome}
                  variacao={v}
                  locais={locaisVisiveis}
                  todosLocais={locaisData}
                  saldoMap={saldoMap}
                />
              )),
            )}
          </div>
        </>
      )}
    </div>
  )
}
