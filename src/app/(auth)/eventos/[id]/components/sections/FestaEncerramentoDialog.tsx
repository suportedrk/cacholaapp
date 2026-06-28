'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, ChevronDown, AlertTriangle, CheckCircle2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useDecoracaoLocais } from '@/hooks/use-decoracao-locais'
import { useEncerrarFesta } from '@/hooks/use-decoracao'
import { cn } from '@/lib/utils'
import type { FestaItemLinha, EncerramentoLinhaInput } from '@/types/decoracao'

/** Estado de desfecho por linha (qtd_ok é derivado). */
interface LinhaState {
  qtd_quebrado: number
  qtd_perdido: number
  qtd_quarentena: number
  motivo: string
  expanded: boolean
}

function variacaoDesc(it: FestaItemLinha): string {
  const partes = [it.tamanho, it.cor, it.detalhe].filter(Boolean)
  return partes.length ? partes.join(' / ') : it.codigo
}

function intInput(raw: string): number {
  const n = Math.floor(Number(raw))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  festaId: string
  eventId: string
  unitName: string | null
  itens: FestaItemLinha[]
}

/**
 * Encerramento item a item da decoração da festa. Cada linha vem "tudo OK";
 * abrir a linha permite informar quebrou/sumiu/quarentena (soma batendo na
 * quantidade). Escolhe o local da baixa (default best-effort pela unidade).
 */
export function FestaEncerramentoDialog({
  open, onOpenChange, festaId, eventId, unitName, itens,
}: Props) {
  const { data: locais = [] } = useDecoracaoLocais('ativos')
  const encerrar = useEncerrarFesta()

  const [linhas, setLinhas] = useState<Record<string, LinhaState>>({})
  const [localId, setLocalId] = useState<string>('')

  // Default do local: casa o nome do local com a unidade da festa (best-effort).
  const localDefault = useMemo(() => {
    if (locais.length === 0) return ''
    const un = (unitName ?? '').toLowerCase()
    const match = locais.find((l) => un.includes(l.nome.toLowerCase()))
    return (match ?? locais[0]).id
  }, [locais, unitName])

  // Hidrata o estado uma vez por abertura do dialog.
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (!open) {
      hydratedRef.current = false
      return
    }
    if (hydratedRef.current) return
    hydratedRef.current = true
    /* eslint-disable react-hooks/set-state-in-effect -- inicializa o form ao abrir */
    const init: Record<string, LinhaState> = {}
    for (const it of itens) {
      init[it.variacao_id] = {
        qtd_quebrado: 0, qtd_perdido: 0, qtd_quarentena: 0, motivo: '', expanded: false,
      }
    }
    setLinhas(init)
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, itens])

  // Aplica o local default assim que os locais carregam (sem re-hidratar linhas).
  useEffect(() => {
    if (!open || localId || !localDefault) return
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- default tardio do local */
    setLocalId(localDefault)
  }, [open, localId, localDefault])

  function reset() {
    setLinhas({})
    setLocalId('')
    hydratedRef.current = false
  }

  function patchLinha(varId: string, patch: Partial<LinhaState>) {
    setLinhas((prev) => ({ ...prev, [varId]: { ...prev[varId], ...patch } }))
  }

  // Validação: para cada linha, quebrado+perdido+quarentena <= quantidade.
  const linhasComputadas = useMemo(() => {
    return itens.map((it) => {
      const st = linhas[it.variacao_id] ?? {
        qtd_quebrado: 0, qtd_perdido: 0, qtd_quarentena: 0, motivo: '', expanded: false,
      }
      const baixa = st.qtd_quebrado + st.qtd_perdido + st.qtd_quarentena
      const qtdOk = it.quantidade - baixa
      const valida = qtdOk >= 0
      const parcial = baixa > 0
      return { it, st, baixa, qtdOk, valida, parcial }
    })
  }, [itens, linhas])

  const algumaInvalida = linhasComputadas.some((l) => !l.valida)
  const totalParciais = linhasComputadas.filter((l) => l.parcial).length

  function handleConfirmar() {
    if (algumaInvalida || !localId) return
    // Envia só as linhas com desfecho não-OK (RPC trata omitidas como tudo OK).
    const payload: EncerramentoLinhaInput[] = linhasComputadas
      .filter((l) => l.parcial)
      .map((l) => ({
        variacao_id: l.it.variacao_id,
        qtd_ok: l.qtdOk,
        qtd_quebrado: l.st.qtd_quebrado,
        qtd_perdido: l.st.qtd_perdido,
        qtd_quarentena: l.st.qtd_quarentena,
        motivo: l.st.qtd_quarentena > 0 ? (l.st.motivo.trim() || null) : null,
      }))

    encerrar.mutate(
      { id: festaId, eventId, itens: payload, localId },
      {
        onSuccess: () => {
          onOpenChange(false)
          reset()
        },
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Encerrar decoração</DialogTitle>
          <DialogDescription>
            Cada item vem como “tudo OK”. Abra a linha só para registrar o que
            quebrou, sumiu ou foi para conserto. A baixa de estoque sai do local
            selecionado.
          </DialogDescription>
        </DialogHeader>

        {/* Local da baixa */}
        <div className="space-y-1.5">
          <Label>Local da baixa de estoque</Label>
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

        {/* Itens */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label>Itens da decoração ({itens.length})</Label>
            {totalParciais > 0 && (
              <span className="text-xs text-amber-600">
                {totalParciais} {totalParciais === 1 ? 'item com ocorrência' : 'itens com ocorrência'}
              </span>
            )}
          </div>

          <ul className="space-y-2">
            {linhasComputadas.map(({ it, st, qtdOk, valida, parcial }) => (
              <li
                key={it.variacao_id}
                className={cn(
                  'rounded-md border bg-surface-primary',
                  valida ? 'border-border-default' : 'border-destructive',
                )}
              >
                <button
                  type="button"
                  onClick={() => patchLinha(it.variacao_id, { expanded: !st.expanded })}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {it.item_nome} — {variacaoDesc(it)}
                    </p>
                    <p className="font-mono text-xs text-text-tertiary">
                      {it.codigo} · {it.quantidade} {it.quantidade === 1 ? 'peça' : 'peças'}
                    </p>
                  </div>
                  {parcial ? (
                    <span className="shrink-0 rounded-full badge-amber border px-2 py-0.5 text-xs font-medium">
                      {qtdOk} ok · {st.qtd_quebrado + st.qtd_perdido + st.qtd_quarentena} ocorr.
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Tudo OK
                    </span>
                  )}
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 text-text-tertiary transition-transform',
                      st.expanded && 'rotate-180',
                    )}
                  />
                </button>

                {st.expanded && (
                  <div className="space-y-2 border-t border-border-default px-3 py-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Quebrou</Label>
                        <Input
                          type="number" inputMode="numeric" min={0} max={it.quantidade}
                          value={st.qtd_quebrado}
                          onChange={(e) => patchLinha(it.variacao_id, { qtd_quebrado: intInput(e.target.value) })}
                          className="text-right"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Sumiu</Label>
                        <Input
                          type="number" inputMode="numeric" min={0} max={it.quantidade}
                          value={st.qtd_perdido}
                          onChange={(e) => patchLinha(it.variacao_id, { qtd_perdido: intInput(e.target.value) })}
                          className="text-right"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Quarentena</Label>
                        <Input
                          type="number" inputMode="numeric" min={0} max={it.quantidade}
                          value={st.qtd_quarentena}
                          onChange={(e) => patchLinha(it.variacao_id, { qtd_quarentena: intInput(e.target.value) })}
                          className="text-right"
                        />
                      </div>
                    </div>

                    {st.qtd_quarentena > 0 && (
                      <div className="space-y-1">
                        <Label className="text-xs">Motivo da quarentena</Label>
                        <Input
                          value={st.motivo}
                          onChange={(e) => patchLinha(it.variacao_id, { motivo: e.target.value })}
                          placeholder="Ex.: tapete rasgado, precisa lavar…"
                        />
                      </div>
                    )}

                    {!valida ? (
                      <p className="flex items-center gap-1.5 text-xs text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        A soma das ocorrências passou da quantidade ({it.quantidade}).
                      </p>
                    ) : (
                      <p className="text-xs text-text-tertiary">
                        Ficam {qtdOk} OK de {it.quantidade}.
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        <DialogFooter>
          <Button
            type="button" variant="outline"
            onClick={() => { reset(); onOpenChange(false) }}
            disabled={encerrar.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirmar}
            disabled={algumaInvalida || !localId || encerrar.isPending || itens.length === 0}
          >
            {encerrar.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Encerrar decoração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
