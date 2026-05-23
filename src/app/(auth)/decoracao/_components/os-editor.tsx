'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  Trash2,
  Plus,
  Loader2,
  AlertCircle,
  GripVertical,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/shared/page-header'
import { hasRole } from '@/config/roles'
import { DECORACAO_DELETE_ROLES } from '@/config/roles'
import { useAuth } from '@/hooks/use-auth'
import { useUnits } from '@/hooks/use-units'
import { useDecoracaoTemas, useBalaoModelos } from '@/hooks/use-decoracao'
import {
  useCreateDecoracaoOS,
  useDecoracaoOSDetail,
  useDeleteDecoracaoOS,
  useUpdateDecoracaoOS,
} from '@/hooks/use-decoracao-os'
import { ROUTES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import {
  STATUS_ITEM_LABEL,
  calcItemValores,
  calcTotalOS,
  formatBRLOuTraco,
} from './os-helpers'
import type {
  DecoracaoOSItemFormInput,
  DecoracaoOSItemStatus,
  DecoracaoBalaoModelo,
} from '@/types/decoracao'

interface Props {
  mode: 'create' | 'edit'
  osId?: string
}

const STATUS_OPTIONS: DecoracaoOSItemStatus[] = ['aguardando_prova', 'aprovada', 'realizada']

function newEmptyItem(ordem: number): DecoracaoOSItemFormInput {
  return {
    balao_modelo_id: null,
    quantidade: 1,
    observacoes: null,
    status: 'aguardando_prova',
    ordem,
  }
}

export function OSEditor({ mode, osId }: Props) {
  const router = useRouter()
  const { profile } = useAuth()
  const canDelete = hasRole(profile?.role, DECORACAO_DELETE_ROLES)

  const { data: units = [] } = useUnits()
  const { data: temas = [] } = useDecoracaoTemas()
  const { data: modelos = [] } = useBalaoModelos()

  const detailQuery = useDecoracaoOSDetail(mode === 'edit' ? osId : undefined)
  const createMutation = useCreateDecoracaoOS()
  const updateMutation = useUpdateDecoracaoOS()
  const deleteMutation = useDeleteDecoracaoOS()
  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  // ── Estado do formulário ─────────────────────────────────────
  const [unitId, setUnitId] = useState<string>('')
  const [dataFesta, setDataFesta] = useState<string>('')
  const [horaFesta, setHoraFesta] = useState<string>('')
  const [tema, setTema] = useState<string>('')
  const [temaId, setTemaId] = useState<string | null>(null)
  const [itens, setItens] = useState<DecoracaoOSItemFormInput[]>([])
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Hidratação inicial (create) — escolhe a primeira unidade do usuário.
  useEffect(() => {
    if (hydrated) return
    if (mode === 'create' && units.length > 0) {
      /* eslint-disable react-hooks/set-state-in-effect -- hidratação inicial uma única vez */
      setUnitId(units[0].id)
      setItens([newEmptyItem(0)])
      setHydrated(true)
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [mode, units, hydrated])

  // Hidratação a partir do detalhe (edit).
  useEffect(() => {
    if (hydrated) return
    if (mode === 'edit' && detailQuery.data) {
      const d = detailQuery.data
      /* eslint-disable react-hooks/set-state-in-effect -- hidratação inicial uma única vez */
      setUnitId(d.unit_id)
      setDataFesta(d.data_festa ?? '')
      setHoraFesta(d.hora_festa ? d.hora_festa.slice(0, 5) : '')
      setTema(d.tema)
      setTemaId(d.tema_id)
      setItens(
        d.itens.map((i) => ({
          id: i.id,
          balao_modelo_id: i.balao_modelo_id,
          quantidade: i.quantidade,
          observacoes: i.observacoes,
          status: i.status,
          ordem: i.ordem,
        })),
      )
      setHydrated(true)
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [mode, detailQuery.data, hydrated])

  // ── Lookups ──────────────────────────────────────────────────
  const modeloById = useMemo(() => {
    const m = new Map<string, DecoracaoBalaoModelo>()
    for (const x of modelos) m.set(x.id, x)
    return m
  }, [modelos])

  const modelosAtivos = useMemo(
    () => modelos.filter((m) => m.ativo).sort((a, b) => a.nome.localeCompare(b.nome)),
    [modelos],
  )

  const temasOrdenados = useMemo(
    () => [...temas].sort((a, b) => a.nome.localeCompare(b.nome)),
    [temas],
  )

  // Total ao vivo — mesma matemática da listagem.
  const total = useMemo(() => {
    return calcTotalOS(
      itens.map((i) => ({
        quantidade: i.quantidade,
        modelo: i.balao_modelo_id ? modeloById.get(i.balao_modelo_id) ?? null : null,
      })),
    )
  }, [itens, modeloById])

  // ── Handlers de itens ────────────────────────────────────────
  function updateItem(idx: number, patch: Partial<DecoracaoOSItemFormInput>) {
    setItens((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function removeItem(idx: number) {
    setItens((prev) => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, ordem: i })))
  }

  function addItem() {
    setItens((prev) => [...prev, newEmptyItem(prev.length)])
  }

  function setAllStatus(s: DecoracaoOSItemStatus) {
    setItens((prev) => prev.map((it) => ({ ...it, status: s })))
  }

  function moveItem(idx: number, delta: number) {
    setItens((prev) => {
      const next = idx + delta
      if (next < 0 || next >= prev.length) return prev
      const cp = [...prev]
      const [m] = cp.splice(idx, 1)
      cp.splice(next, 0, m)
      return cp.map((it, i) => ({ ...it, ordem: i }))
    })
  }

  // ── Salvar / cancelar / excluir ──────────────────────────────
  async function handleSave() {
    if (!unitId) return
    const temaTrim = tema.trim()
    if (!temaTrim) return

    const payload = {
      unit_id: unitId,
      data_festa: dataFesta || null,
      hora_festa: horaFesta || null,
      tema: temaTrim,
      tema_id: temaId,
      itens: itens.map((it, i) => ({ ...it, ordem: i })),
    }

    try {
      if (mode === 'create') {
        const newId = await createMutation.mutateAsync(payload)
        router.push(`${ROUTES.decoracaoOrdens}/${newId}`)
      } else if (osId) {
        await updateMutation.mutateAsync({ id: osId, input: payload })
        router.push(ROUTES.decoracaoOrdens)
      }
    } catch {
      // toast disparado pelo hook
    }
  }

  async function handleDelete() {
    if (!osId) return
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    try {
      await deleteMutation.mutateAsync(osId)
      router.push(ROUTES.decoracaoOrdens)
    } catch {
      // toast disparado pelo hook
    }
  }

  function handleCancel() {
    router.push(ROUTES.decoracaoOrdens)
  }

  // ── Loading state do edit antes de hidratar ─────────────────
  if (mode === 'edit' && detailQuery.isLoading && !detailQuery.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Carregando ordem…" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="skeleton-shimmer h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (mode === 'edit' && detailQuery.isError) {
    return (
      <div className="space-y-6">
        <PageHeader title="Ordem não encontrada" />
        <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">
            Não foi possível carregar a ordem solicitada.
          </p>
          <Button variant="outline" size="sm" onClick={handleCancel}>
            Voltar
          </Button>
        </div>
      </div>
    )
  }

  const canSave = !!unitId && !!tema.trim() && !isPending

  return (
    <div className="space-y-6">
      <PageHeader
        title={mode === 'create' ? 'Nova ordem de serviço' : 'Editar ordem de serviço'}
      />

      {/* Cabeçalho da OS */}
      <div className="grid grid-cols-1 gap-4 rounded-lg border border-border-default bg-card p-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="os-unit">Unidade *</Label>
          <Select value={unitId} onValueChange={(v) => setUnitId(v ?? '')}>
            <SelectTrigger id="os-unit">
              <SelectValue placeholder="Selecione…">
                {units.find((u) => u.id === unitId)?.name ?? 'Selecione…'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="os-data">Data da festa</Label>
          <Input
            id="os-data"
            type="date"
            value={dataFesta}
            onChange={(e) => setDataFesta(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="os-hora">Hora da festa</Label>
          <Input
            id="os-hora"
            type="time"
            value={horaFesta}
            onChange={(e) => setHoraFesta(e.target.value)}
          />
        </div>

        <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
          <Label htmlFor="os-tema">Tema *</Label>
          <Input
            id="os-tema"
            value={tema}
            onChange={(e) => setTema(e.target.value)}
            placeholder='Ex.: "Pokémon + Corinthians"'
          />
        </div>

        <div className="space-y-1.5 md:col-span-2 lg:col-span-4">
          <Label htmlFor="os-tema-id">Vincular ao catálogo de temas (opcional)</Label>
          <Select
            value={temaId ?? '__none'}
            onValueChange={(v) => setTemaId(v === '__none' ? null : v)}
          >
            <SelectTrigger id="os-tema-id">
              <SelectValue placeholder="Sem vínculo">
                {temaId
                  ? temasOrdenados.find((t) => t.id === temaId)?.nome ?? 'Tema'
                  : 'Sem vínculo'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Sem vínculo</SelectItem>
              {temasOrdenados.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Tema é texto livre; o vínculo serve para referenciar um tema do catálogo (ex.: cores
            de forminha sugeridas).
          </p>
        </div>
      </div>

      {/* Lista de itens */}
      <div className="rounded-lg border border-border-default bg-card">
        <div className="flex items-center justify-between border-b border-border-default px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold">Itens</h2>
            <p className="text-xs text-muted-foreground">
              Selecione o modelo de balão. Preços de custo e venda são calculados ao vivo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" disabled={itens.length === 0}>
                    Marcar todos como
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                }
              />
              <DropdownMenuContent>
                {STATUS_OPTIONS.map((s) => (
                  <DropdownMenuItem key={s} onSelect={() => setAllStatus(s)}>
                    {STATUS_ITEM_LABEL[s]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="outline" onClick={addItem}>
              <Plus className="mr-1.5 h-4 w-4" />
              Adicionar item
            </Button>
          </div>
        </div>

        {itens.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Nenhum item ainda. Clique em &ldquo;Adicionar item&rdquo;.
          </div>
        ) : (
          <ul className="divide-y divide-border-default">
            {itens.map((it, idx) => {
              const modelo = it.balao_modelo_id ? modeloById.get(it.balao_modelo_id) ?? null : null
              const { custo, venda } = calcItemValores(modelo, it.quantidade)
              return (
                <li key={it.id ?? `new-${idx}`} className="grid grid-cols-12 gap-3 px-4 py-3">
                  {/* Reordenar */}
                  <div className="col-span-12 flex items-center gap-1 sm:col-span-1">
                    <button
                      type="button"
                      onClick={() => moveItem(idx, -1)}
                      disabled={idx === 0}
                      className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                      aria-label="Mover para cima"
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                    <span className="text-xs text-muted-foreground tabular-nums">{idx + 1}</span>
                  </div>

                  {/* Modelo */}
                  <div className="col-span-12 sm:col-span-4">
                    <Select
                      value={it.balao_modelo_id ?? '__tbd'}
                      onValueChange={(v) =>
                        updateItem(idx, { balao_modelo_id: v === '__tbd' ? null : v })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>
                          {it.balao_modelo_id
                            ? modeloById.get(it.balao_modelo_id)?.nome ?? 'Modelo'
                            : 'A definir'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__tbd">A definir</SelectItem>
                        {modelosAtivos.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quantidade */}
                  <div className="col-span-3 sm:col-span-1">
                    <Input
                      type="number"
                      min={1}
                      value={it.quantidade}
                      onChange={(e) =>
                        updateItem(idx, {
                          quantidade: Math.max(1, parseInt(e.target.value || '1', 10)),
                        })
                      }
                      className="tabular-nums"
                    />
                  </div>

                  {/* Custo (calculado) */}
                  <div className="col-span-4 sm:col-span-1">
                    <div className="flex h-9 items-center justify-end rounded-md border border-dashed border-border-default px-2 text-xs tabular-nums text-muted-foreground">
                      {formatBRLOuTraco(custo)}
                    </div>
                  </div>

                  {/* Venda (calculado) */}
                  <div className="col-span-5 sm:col-span-1">
                    <div className="flex h-9 items-center justify-end rounded-md border border-dashed border-border-default px-2 text-xs tabular-nums font-medium">
                      {formatBRLOuTraco(venda)}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-8 sm:col-span-2">
                    <Select
                      value={it.status}
                      onValueChange={(v) =>
                        updateItem(idx, { status: (v ?? 'aguardando_prova') as DecoracaoOSItemStatus })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>{STATUS_ITEM_LABEL[it.status]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {STATUS_ITEM_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Excluir item */}
                  <div className="col-span-4 flex items-start justify-end sm:col-span-2 sm:items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(idx)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Observação (linha cheia) */}
                  <div className="col-span-12">
                    <Textarea
                      value={it.observacoes ?? ''}
                      onChange={(e) => updateItem(idx, { observacoes: e.target.value || null })}
                      placeholder="Observação do item (opcional)"
                      rows={1}
                      className="min-h-[2.25rem]"
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {/* Total */}
        <div className="flex items-center justify-end gap-4 border-t border-border-default px-4 py-3">
          <span className="text-sm text-muted-foreground">Total de venda</span>
          <span className="text-lg font-semibold tabular-nums">
            {itens.length === 0 ? '—' : formatBRLOuTraco(total)}
          </span>
        </div>
      </div>

      {/* Footer com ações */}
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {mode === 'edit' && canDelete && (
            <Button
              type="button"
              variant={confirmingDelete ? 'destructive' : 'outline'}
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              <Trash2 className={cn('h-4 w-4', !deleteMutation.isPending && 'mr-1.5')} />
              {confirmingDelete ? 'Confirmar exclusão' : 'Excluir ordem'}
            </Button>
          )}
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {(createMutation.isPending || updateMutation.isPending) && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {mode === 'create' ? 'Criar ordem' : 'Salvar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
