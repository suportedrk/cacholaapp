'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, ArrowRight, Loader2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDecoracaoLocais } from '@/hooks/use-decoracao-locais'
import {
  useCriarTransferencia,
  useEstoqueSaldoOrigem,
  type VariacaoComSaldoNaOrigem,
} from '@/hooks/use-decoracao-transferencias'
import { ROUTES } from '@/lib/constants'
import { cn } from '@/lib/utils'

interface ItemLinha {
  variacao_id: string
  quantidade: number
}

/**
 * Pré-preenchimento vindo da sugestão pela festa (Bloco F). O pai força
 * remount via `key` ao injetar um seed — por isso o estado inicial lê o seed
 * uma única vez (sem effect-hydration, que brigaria com handleOrigemChange).
 */
export interface NovaTransferenciaSeed {
  origem: string
  destino: string
  itens: ItemLinha[]
}

interface NovaTransferenciaSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialSeed?: NovaTransferenciaSeed
}

function variacaoLabel(v: VariacaoComSaldoNaOrigem): string {
  const partes = [v.tamanho, v.cor, v.detalhe].filter(Boolean)
  const desc = partes.length ? partes.join(' / ') : v.codigo
  return `${v.item_nome} — ${desc}`
}

export function NovaTransferenciaSheet({
  open,
  onOpenChange,
  initialSeed,
}: NovaTransferenciaSheetProps) {
  const router = useRouter()
  // Estado inicial lê o seed uma vez (remount via key no pai). Sem seed → vazio.
  const [origem, setOrigem] = useState<string>(() => initialSeed?.origem ?? '')
  const [destino, setDestino] = useState<string>(() => initialSeed?.destino ?? '')
  const [observacoes, setObservacoes] = useState('')
  const [itens, setItens] = useState<ItemLinha[]>(() => initialSeed?.itens ?? [])

  const { data: locais = [] } = useDecoracaoLocais('ativos')
  const { data: saldosOrigem = [], isLoading: loadingSaldos } = useEstoqueSaldoOrigem(
    origem || undefined,
  )
  const { mutateAsync: criar, isPending } = useCriarTransferencia()

  function resetForm() {
    setOrigem('')
    setDestino('')
    setObservacoes('')
    setItens([])
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm()
    onOpenChange(next)
  }

  function handleOrigemChange(v: string) {
    setOrigem(v)
    // Saldos referem-se a outra origem — limpa os itens já selecionados
    setItens([])
    // Se o destino atual coincidir com a nova origem, limpa também
    if (v && v === destino) setDestino('')
  }

  // Mapa variacao_id → saldo na origem
  const saldoByVar = useMemo(() => {
    const m = new Map<string, VariacaoComSaldoNaOrigem>()
    for (const v of saldosOrigem) m.set(v.variacao_id, v)
    return m
  }, [saldosOrigem])

  // Variações ainda não adicionadas
  const variacoesDisponiveis = saldosOrigem.filter(
    (v) => !itens.some((it) => it.variacao_id === v.variacao_id),
  )

  function adicionarItem(variacao_id: string) {
    const v = saldoByVar.get(variacao_id)
    if (!v) return
    setItens((prev) => [...prev, { variacao_id, quantidade: 1 }])
  }

  function removerItem(idx: number) {
    setItens((prev) => prev.filter((_, i) => i !== idx))
  }

  function atualizarQuantidade(idx: number, valor: string) {
    const num = parseInt(valor, 10)
    setItens((prev) => {
      const next = [...prev]
      const linha = next[idx]
      const v = saldoByVar.get(linha.variacao_id)
      const max = v?.saldo ?? 0
      let q = isNaN(num) || num < 1 ? 1 : num
      if (q > max) q = max
      next[idx] = { ...linha, quantidade: q }
      return next
    })
  }

  const podeLancar =
    !!origem &&
    !!destino &&
    origem !== destino &&
    itens.length > 0 &&
    itens.every(
      (it) => it.quantidade > 0 && it.quantidade <= (saldoByVar.get(it.variacao_id)?.saldo ?? 0),
    )

  async function handleLancar() {
    try {
      const id = await criar({
        origem_local_id: origem,
        destino_local_id: destino,
        observacoes: observacoes.trim() || null,
        itens,
      })
      toast.success('Transferência lançada.')
      resetForm()
      onOpenChange(false)
      router.push(`${ROUTES.decoracaoTransferencias}/${id}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao lançar transferência.'
      toast.error(msg)
    }
  }

  // Destinos válidos: locais ativos != origem
  const destinosValidos = locais.filter((l) => l.id !== origem)

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="data-[side=right]:!max-w-2xl w-full overflow-y-auto p-0"
      >
        <SheetHeader className="border-b p-4">
          <SheetTitle>Nova transferência</SheetTitle>
          <SheetDescription>
            Move peças de um local para outro. O saldo sai da origem ao lançar.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 p-4">
          {/* Origem e Destino */}
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Origem</label>
              <Select value={origem} onValueChange={(v) => handleOrigemChange(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {origem ? locais.find((l) => l.id === origem)?.nome : 'Selecione…'}
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

            <div className="flex justify-center pb-2 sm:pb-3">
              <ArrowRight className="h-5 w-5 text-text-tertiary" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-secondary">Destino</label>
              <Select
                value={destino}
                onValueChange={(v) => setDestino(v ?? '')}
                disabled={!origem}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {destino ? locais.find((l) => l.id === destino)?.nome : 'Selecione…'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {destinosValidos.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Itens */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">Itens</h3>
              <span className="text-xs text-text-tertiary">
                {itens.length} {itens.length === 1 ? 'item' : 'itens'}
              </span>
            </div>

            {!origem ? (
              <p className="rounded-md border border-dashed p-4 text-center text-xs text-text-tertiary">
                Selecione a origem para listar variações com saldo disponível.
              </p>
            ) : loadingSaldos ? (
              <p className="text-xs text-text-tertiary">Carregando saldos…</p>
            ) : saldosOrigem.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-center text-xs text-text-tertiary">
                Nenhuma variação com saldo na origem selecionada.
              </p>
            ) : (
              <>
                {/* Linhas de item */}
                {itens.length > 0 && (
                  <ul className="space-y-2">
                    {itens.map((it, idx) => {
                      const v = saldoByVar.get(it.variacao_id)
                      const max = v?.saldo ?? 0
                      return (
                        <li
                          key={it.variacao_id}
                          className="grid gap-2 rounded-md border bg-surface-primary p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {v ? variacaoLabel(v) : '—'}
                            </p>
                            <p className="font-mono text-xs text-text-tertiary">
                              {v?.codigo} · disponível: {max}
                            </p>
                          </div>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={max}
                            value={it.quantidade}
                            onChange={(e) => atualizarQuantidade(idx, e.target.value)}
                            className="w-24 text-right"
                          />
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removerItem(idx)}
                            aria-label="Remover item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {/* Adicionar nova variação */}
                {variacoesDisponiveis.length > 0 ? (
                  <Select
                    value=""
                    onValueChange={(v) => {
                      if (v) adicionarItem(v)
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        <span className="flex items-center gap-1.5 text-text-secondary">
                          <Plus className="h-4 w-4" />
                          Adicionar item…
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {variacoesDisponiveis.map((v) => (
                        <SelectItem key={v.variacao_id} value={v.variacao_id}>
                          <span className="flex w-full items-center justify-between gap-3">
                            <span>{variacaoLabel(v)}</span>
                            <span className="font-mono text-xs text-text-tertiary">
                              {v.codigo} · {v.saldo}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  itens.length > 0 && (
                    <p className="text-xs text-text-tertiary">
                      Todas as variações com saldo já foram adicionadas.
                    </p>
                  )
                )}
              </>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <label
              htmlFor="transferencia-obs"
              className="text-xs font-medium text-text-secondary"
            >
              Observações (opcional)
            </label>
            <textarea
              id="transferencia-obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              className={cn(
                'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm',
                'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              )}
              placeholder="Ex.: enviar com motorista da manhã"
            />
          </div>
        </div>

        {/* Rodapé */}
        <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-surface-primary p-4">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button onClick={handleLancar} disabled={!podeLancar || isPending}>
            {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Lançar transferência
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
