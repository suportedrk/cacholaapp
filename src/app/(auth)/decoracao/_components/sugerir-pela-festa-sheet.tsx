'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, Loader2, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDecoracaoLocais } from '@/hooks/use-decoracao-locais'
import {
  useFestasComDecoracao,
  useSugestaoTransferencia,
} from '@/hooks/use-sugestao-transferencia'
import { cn } from '@/lib/utils'
import type {
  FestaComDecoracaoResumo,
  LinhaSugestaoTransferencia,
} from '@/types/decoracao'
import type { NovaTransferenciaSeed } from './nova-transferencia-sheet'

interface SugerirPelaFestaSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Handoff: pré-preenche e abre a Nova transferência com o seed da sugestão. */
  onCriarTransferencia: (seed: NovaTransferenciaSeed) => void
}

function variacaoDesc(l: LinhaSugestaoTransferencia): string {
  const partes = [l.tamanho, l.cor, l.detalhe].filter(Boolean)
  return partes.length ? partes.join(' / ') : l.codigo
}

function festaLabel(f: FestaComDecoracaoResumo): string {
  const quem = f.client_name || f.event_title || 'Festa'
  const data = f.event_date
    ? new Date(f.event_date + 'T00:00:00').toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      })
    : null
  return data ? `${quem} · ${data}` : quem
}

export function SugerirPelaFestaSheet({
  open,
  onOpenChange,
  onCriarTransferencia,
}: SugerirPelaFestaSheetProps) {
  const [festaId, setFestaId] = useState<string>('')
  const [destino, setDestino] = useState<string>('')
  const [origem, setOrigem] = useState<string>('')
  // Trava o default best-effort após a primeira escolha de festa (não re-clobber).
  const [destinoTocado, setDestinoTocado] = useState(false)
  const [origemTocado, setOrigemTocado] = useState(false)

  const { data: festas = [], isLoading: loadingFestas } = useFestasComDecoracao()
  const { data: locais = [] } = useDecoracaoLocais('ativos')

  const festaSel = festas.find((f) => f.festa_decoracao_id === festaId)

  // Destino best-effort: casa o nome do local com a unidade da festa (Bloco D).
  const destinoDefault = useMemo(() => {
    if (!festaSel || locais.length === 0) return ''
    const un = (festaSel.unit_name ?? '').toLowerCase()
    const match = locais.find((l) => un.includes(l.nome.toLowerCase()))
    return (match ?? locais[0]).id
  }, [festaSel, locais])

  // Destino efetivo (escolha manual sobrepõe o default best-effort).
  const destinoEfetivo = destinoTocado ? destino : destinoDefault

  // Origem default: o outro local ativo (correto p/ 2 locais; Select cobre +).
  const origemDefault = useMemo(() => {
    if (!destinoEfetivo || locais.length === 0) return ''
    const outro = locais.find((l) => l.id !== destinoEfetivo)
    return outro?.id ?? ''
  }, [locais, destinoEfetivo])

  // Origem efetiva (escolha manual sobrepõe o default).
  const origemEfetivo = origemTocado ? origem : origemDefault

  const {
    data: linhas = [],
    isLoading: loadingSugestao,
    isFetching,
  } = useSugestaoTransferencia(
    festaId || undefined,
    destinoEfetivo || undefined,
    origemEfetivo || undefined,
  )

  function handleFestaChange(v: string) {
    setFestaId(v)
    // Nova festa → volta aos defaults best-effort.
    setDestinoTocado(false)
    setOrigemTocado(false)
    setDestino('')
    setOrigem('')
  }

  const localNome = (id: string) => locais.find((l) => l.id === id)?.nome ?? '—'

  const podeCriar =
    !!festaId &&
    !!destinoEfetivo &&
    !!origemEfetivo &&
    destinoEfetivo !== origemEfetivo &&
    linhas.some((l) => l.sugerido > 0)

  function handleCriar() {
    const itens = linhas
      .filter((l) => l.sugerido > 0)
      .map((l) => ({ variacao_id: l.variacao_id, quantidade: l.sugerido }))
    if (itens.length === 0) return
    onCriarTransferencia({ origem: origemEfetivo, destino: destinoEfetivo, itens })
  }

  const mesmoLocal = !!destinoEfetivo && destinoEfetivo === origemEfetivo
  const semFalta = !!festaId && !loadingSugestao && !isFetching && linhas.length === 0
  const algumSugerido = linhas.some((l) => l.sugerido > 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="data-[side=right]:!max-w-2xl w-full overflow-y-auto p-0"
      >
        <SheetHeader className="border-b p-4">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Sugerir pela festa
          </SheetTitle>
          <SheetDescription>
            Escolha uma festa com decoração: comparamos a lista dela com o saldo no
            local e sugerimos o que trazer da outra unidade.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 p-4">
          {/* Seletor de festa */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary">Festa</label>
            <Select value={festaId} onValueChange={(v) => handleFestaChange(v ?? '')}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {festaSel ? festaLabel(festaSel) : 'Selecione uma festa…'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {loadingFestas ? (
                  <div className="px-2 py-1.5 text-xs text-text-tertiary">Carregando…</div>
                ) : festas.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-text-tertiary">
                    Nenhuma festa com decoração aberta.
                  </div>
                ) : (
                  festas.map((f) => (
                    <SelectItem key={f.festa_decoracao_id} value={f.festa_decoracao_id}>
                      <span className="flex w-full items-center justify-between gap-3">
                        <span>{festaLabel(f)}</span>
                        {f.unit_name && (
                          <span className="text-xs text-text-tertiary">{f.unit_name}</span>
                        )}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Origem → Destino (ajustáveis; default best-effort) */}
          {festaId && (
            <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">
                  Trazer de (origem)
                </label>
                <Select
                  value={origemEfetivo}
                  onValueChange={(v) => {
                    setOrigemTocado(true)
                    setOrigem(v ?? '')
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {origemEfetivo ? localNome(origemEfetivo) : 'Selecione…'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {locais
                      .filter((l) => l.id !== destinoEfetivo)
                      .map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-center pb-2 sm:pb-3">
                <ArrowRight className="h-5 w-5 text-text-tertiary" />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-secondary">
                  Local da festa (destino)
                </label>
                <Select
                  value={destinoEfetivo}
                  onValueChange={(v) => {
                    setDestinoTocado(true)
                    setDestino(v ?? '')
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {destinoEfetivo ? localNome(destinoEfetivo) : 'Selecione…'}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {locais.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Tabela de sugestão / estados */}
          {festaId && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Sugestão</h3>

              {mesmoLocal ? (
                <p className="rounded-md border border-dashed p-4 text-center text-xs text-text-tertiary">
                  Origem e destino devem ser locais diferentes.
                </p>
              ) : loadingSugestao || isFetching ? (
                <p className="flex items-center gap-2 text-xs text-text-tertiary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Calculando o que falta…
                </p>
              ) : semFalta ? (
                <div className="flex flex-col items-center gap-2 rounded-md border border-status-success-border bg-status-success-bg p-6 text-center text-status-success-text">
                  <CheckCircle2 className="h-7 w-7" />
                  <p className="text-sm font-medium">
                    O local da festa já tem tudo — sem transferência necessária.
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-surface-secondary text-left text-xs text-text-secondary">
                          <th className="px-3 py-2 font-medium">Item</th>
                          <th className="px-2 py-2 text-right font-medium">Precisa</th>
                          <th className="px-2 py-2 text-right font-medium">Tem</th>
                          <th className="px-2 py-2 text-right font-medium">Falta</th>
                          <th className="px-3 py-2 text-right font-medium">Trazer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linhas.map((l) => {
                          const semOrigem = l.sugerido === 0
                          return (
                            <tr
                              key={l.variacao_id}
                              className={cn(
                                'border-b last:border-0',
                                semOrigem && 'bg-status-warning-bg/40',
                              )}
                            >
                              <td className="px-3 py-2">
                                <p className="font-medium">{l.item_nome}</p>
                                <p className="font-mono text-xs text-text-tertiary">
                                  {l.codigo} · {variacaoDesc(l)}
                                </p>
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums">{l.precisa}</td>
                              <td className="px-2 py-2 text-right tabular-nums">{l.tem}</td>
                              <td className="px-2 py-2 text-right font-semibold tabular-nums text-status-warning-text">
                                {l.falta}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {semOrigem ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-text-tertiary">
                                    <AlertTriangle className="h-3 w-3" />
                                    sem saldo na origem
                                  </span>
                                ) : (
                                  <span className="font-semibold tabular-nums">{l.sugerido}</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {!algumSugerido && (
                    <p className="flex items-center gap-1.5 text-xs text-status-warning-text">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      A origem selecionada não cobre nenhuma das faltas. Tente outra origem.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-surface-primary p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCriar} disabled={!podeCriar}>
            Criar transferência com essas sugestões
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
