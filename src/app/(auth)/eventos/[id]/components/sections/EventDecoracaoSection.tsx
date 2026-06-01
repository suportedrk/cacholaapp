'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Sparkles, ChevronDown, Loader2, Plus, Trash2, Printer,
  Link2, ImageOff, AlertTriangle, Lock, CheckCircle2, Flag,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { PhotoDropZone, PhotoThumb } from '@/components/shared/photo-upload'
import { useSignedUrls } from '@/hooks/use-signed-urls'
import { useAuth } from '@/hooks/use-auth'
import { hasRole, DECORACAO_MANAGE_ROLES, DECORACAO_DELETE_ROLES } from '@/config/roles'
import { DECORACAO_BUCKETS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import {
  useFestaDecoracao,
  useVincularTema,
  useUpdateFestaDecoracao,
  useDeleteFestaDecoracao,
  useDecoracaoTemas,
  useDecoracaoVariacoesCatalog,
} from '@/hooks/use-decoracao'
import { cn } from '@/lib/utils'
import { FestaRomaneioPrintDialog } from './FestaRomaneioPrintDialog'
import { FestaEncerramentoDialog } from './FestaEncerramentoDialog'
import { FestaFotosGaleria } from './FestaFotosGaleria'
import type { FestaItemLinha } from '@/types/decoracao'

function formatDataHora(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
    }).format(new Date(iso))
  } catch {
    return '—'
  }
}

const FESTA_BUCKET = DECORACAO_BUCKETS.festa
const TEMA_BUCKET = DECORACAO_BUCKETS.temas

/** Linha editável no estado local. */
interface ItemForm {
  variacao_id: string
  quantidade: number
}

function variacaoDesc(v: {
  item_nome: string
  tamanho: string | null
  cor: string | null
  detalhe: string | null
  codigo: string
}): string {
  const partes = [v.tamanho, v.cor, v.detalhe].filter(Boolean)
  const desc = partes.length ? partes.join(' / ') : v.codigo
  return `${v.item_nome} — ${desc}`
}

interface VariacaoInfo {
  desc: string
  codigo: string
  linha: FestaItemLinha | null
}

interface EventDecoracaoSectionProps {
  eventId: string
  eventTitle: string
  eventDate: string
  unitName: string | null
  clientName: string | null
}

export function EventDecoracaoSection({
  eventId,
  eventTitle,
  eventDate,
  unitName,
  clientName,
}: EventDecoracaoSectionProps) {
  const { profile } = useAuth()
  const canUse = hasRole(profile?.role, DECORACAO_MANAGE_ROLES)
  const canDelete = hasRole(profile?.role, DECORACAO_DELETE_ROLES)

  const [isOpen, setIsOpen] = useState(false)

  const { data, isLoading, isError } = useFestaDecoracao(isOpen ? eventId : null)
  const { data: temas = [] } = useDecoracaoTemas()
  const { data: variacoesCatalog = [] } = useDecoracaoVariacoesCatalog()

  const vincular = useVincularTema()
  const update = useUpdateFestaDecoracao()
  const del = useDeleteFestaDecoracao()
  const isMutating = vincular.isPending || update.isPending || del.isPending

  // ── Estado local editável ──
  const [itens, setItens] = useState<ItemForm[]>([])
  const [observacoes, setObservacoes] = useState('')
  const [fotoPath, setFotoPath] = useState<string | null>(null) // override (bucket festa)
  const [dirty, setDirty] = useState(false)

  // Hidrata uma vez por decoração carregada (keyed by festa id).
  const hydratedRef = useRef<string | null>(null)
  // Uploads pendentes (override) ainda não confirmados pelo Salvar.
  const pendingUploadsRef = useRef<string[]>([])

  // ── Picker de tema + confirmação de re-vínculo + romaneio + encerramento ──
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerTemaId, setPickerTemaId] = useState('')
  const [romaneioOpen, setRomaneioOpen] = useState(false)
  const [encerrarOpen, setEncerrarOpen] = useState(false)

  const temasAtivos = useMemo(() => temas.filter((t) => t.ativo), [temas])
  const hasDecoracao = !!data
  const isEncerrada = data?.status === 'encerrada'

  // Hidratação do form a partir da query.
  useEffect(() => {
    if (!data) {
      hydratedRef.current = null
      return
    }
    if (hydratedRef.current === data.id) return
    hydratedRef.current = data.id
    /* eslint-disable react-hooks/set-state-in-effect -- sincroniza query→form ao carregar a decoração */
    setItens(data.itens.map((l) => ({ variacao_id: l.variacao_id, quantidade: l.quantidade })))
    setObservacoes(data.observacoes ?? '')
    setFotoPath(data.foto_path)
    setDirty(false)
    /* eslint-enable react-hooks/set-state-in-effect */
    pendingUploadsRef.current = []
  }, [data])

  // ── Fotos (cross-bucket): override em decoracao-festa, modelo em decoracao-temas ──
  const overridePaths = fotoPath ? [fotoPath] : []
  const { data: overrideSigned = {} } = useSignedUrls(FESTA_BUCKET, overridePaths)
  const modeloPaths = data?.tema_foto_url ? [data.tema_foto_url] : []
  const { data: modeloSigned = {} } = useSignedUrls(TEMA_BUCKET, modeloPaths)

  const fotoSrc = fotoPath
    ? overrideSigned[fotoPath]
    : data?.tema_foto_url
      ? modeloSigned[data.tema_foto_url]
      : undefined
  const fotoIsOverride = !!fotoPath

  // ── Mapa variação → descrição/código (mescla itens da festa + catálogo) ──
  const infoByVariacao = useMemo(() => {
    const map = new Map<string, VariacaoInfo>()
    for (const v of variacoesCatalog) {
      map.set(v.variacao_id, { desc: variacaoDesc(v), codigo: v.codigo, linha: null })
    }
    for (const l of data?.itens ?? []) {
      map.set(l.variacao_id, { desc: variacaoDesc(l), codigo: l.codigo, linha: l })
    }
    return map
  }, [variacoesCatalog, data])

  const variacoesDisponiveis = useMemo(() => {
    const usados = new Set(itens.map((i) => i.variacao_id))
    return variacoesCatalog.filter((v) => !usados.has(v.variacao_id))
  }, [variacoesCatalog, itens])

  // ── Handlers de lista ──
  function adicionarVariacao(varId: string) {
    if (!varId || itens.some((i) => i.variacao_id === varId)) return
    setItens((prev) => [...prev, { variacao_id: varId, quantidade: 1 }])
    setDirty(true)
  }
  function removerItem(varId: string) {
    setItens((prev) => prev.filter((i) => i.variacao_id !== varId))
    setDirty(true)
  }
  function atualizarQuantidade(varId: string, raw: string) {
    const n = Math.max(1, Math.floor(Number(raw) || 1))
    setItens((prev) => prev.map((i) => (i.variacao_id === varId ? { ...i, quantidade: n } : i)))
    setDirty(true)
  }

  // ── Foto override ──
  async function handleFotoUpload(path: string) {
    pendingUploadsRef.current.push(path)
    setFotoPath(path)
    setDirty(true)
  }
  function handleFotoRemove() {
    setFotoPath(null) // volta para a foto modelo do tema
    setDirty(true)
  }

  async function cleanupOrphanUploads(savedPath: string | null) {
    const orphans = pendingUploadsRef.current.filter((p) => p !== savedPath)
    pendingUploadsRef.current = []
    if (orphans.length === 0) return
    try {
      const supabase = createClient()
      await supabase.storage.from(FESTA_BUCKET).remove(orphans)
    } catch {
      // fire-and-forget — órfãos cobertos por cron futuro (débito conhecido)
    }
  }

  // ── Salvar / Cancelar ──
  function handleSalvar() {
    if (!data) return
    update.mutate(
      {
        id: data.id,
        eventId,
        itens: itens.map((i, idx) => ({
          variacao_id: i.variacao_id,
          quantidade: i.quantidade,
          ordem: idx,
        })),
        foto_path: fotoPath,
        observacoes,
      },
      {
        onSuccess: () => {
          // o foto_path salvo é o atual; limpa overrides anteriores órfãos
          void cleanupOrphanUploads(fotoPath)
          setDirty(false)
        },
      },
    )
  }

  function handleCancelar() {
    if (!data) return
    void cleanupOrphanUploads(data.foto_path)
    setItens(data.itens.map((l) => ({ variacao_id: l.variacao_id, quantidade: l.quantidade })))
    setObservacoes(data.observacoes ?? '')
    setFotoPath(data.foto_path)
    setDirty(false)
  }

  // ── Vincular / re-vincular ──
  function openPicker() {
    setPickerTemaId('')
    setPickerOpen(true)
  }
  function confirmPicker() {
    if (!pickerTemaId) return
    vincular.mutate(
      { eventId, temaId: pickerTemaId },
      {
        onSuccess: () => {
          // força re-hidratação do form pela próxima carga da query
          hydratedRef.current = null
          setPickerOpen(false)
        },
      },
    )
  }

  function handleDesvincular() {
    if (!data) return
    del.mutate({ id: data.id, eventId })
  }

  // ── Romaneio: usa a lista SALVA (data.itens), não o rascunho ──
  const romaneioData = useMemo(
    () => ({
      eventTitle,
      eventDate,
      unitName,
      clientName,
      temaNome: data?.tema_nome ?? null,
      itens: data?.itens ?? [],
    }),
    [eventTitle, eventDate, unitName, clientName, data],
  )

  // A seção só aparece para quem opera Decoração (dado é RLS-protegido;
  // espelho convertível — backlog).
  if (!canUse) return null

  const totalPecas = itens.reduce((acc, i) => acc + i.quantidade, 0)

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2.5 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
        aria-expanded={isOpen}
      >
        <Sparkles className="w-4 h-4 text-text-secondary shrink-0" />
        <span className="text-sm font-medium text-text-primary flex-1">Decoração</span>
        {isLoading && isOpen && <Loader2 className="w-3.5 h-3.5 text-text-tertiary animate-spin" />}
        {!isLoading && hasDecoracao && data?.tema_nome && (
          <span className="text-xs text-text-tertiary truncate max-w-[140px]">{data.tema_nome}</span>
        )}
        {!isLoading && isEncerrada && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-text-secondary">
            <Lock className="h-3 w-3" />
            Encerrada
          </span>
        )}
        <ChevronDown className={cn('w-4 h-4 text-text-tertiary transition-transform duration-200', isOpen && 'rotate-180')} />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 space-y-4">

            {isLoading && (
              <div className="space-y-2 pt-1">
                <div className="h-4 w-3/4 rounded skeleton-shimmer" />
                <div className="h-4 w-1/2 rounded skeleton-shimmer" />
              </div>
            )}

            {isError && (
              <p className="text-sm text-destructive">Erro ao carregar a decoração da festa.</p>
            )}

            {/* ── Sem decoração ── */}
            {!isLoading && !isError && !hasDecoracao && (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <Sparkles className="w-8 h-8 text-text-tertiary/40" />
                <p className="text-sm text-text-secondary">
                  Nenhum tema vinculado a esta festa.
                </p>
                <Button size="sm" className="gap-1.5" onClick={openPicker}>
                  <Link2 className="w-3.5 h-3.5" />
                  Vincular tema
                </Button>
              </div>
            )}

            {/* ── Com decoração ── */}
            {!isLoading && !isError && hasDecoracao && data && (
              <>
                {/* Tema + foto */}
                <div className="flex items-start gap-3">
                  <div className="shrink-0">
                    {fotoSrc ? (
                      fotoIsOverride ? (
                        <PhotoThumb src={fotoSrc} alt={data.tema_nome ?? 'foto da festa'} onRemove={handleFotoRemove} disabled={isMutating} />
                      ) : (
                        <PhotoThumb src={fotoSrc} alt={data.tema_nome ?? 'foto modelo'} />
                      )
                    ) : (
                      <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-border-default text-text-tertiary">
                        <ImageOff className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-text-tertiary">Tema</p>
                    <p className="text-sm font-medium text-text-primary">{data.tema_nome ?? '—'}</p>
                    <p className="mt-0.5 text-xs text-text-tertiary">
                      {fotoIsOverride ? 'Foto própria da festa' : 'Foto modelo do tema'}
                    </p>
                    {!isEncerrada && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={openPicker}>
                          <Link2 className="w-3.5 h-3.5" />
                          Vincular outro tema
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Banner de encerrada */}
                {isEncerrada && (
                  <div className="flex items-start gap-2 rounded-lg border border-border-default bg-muted/40 px-3 py-2 text-xs text-text-secondary">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
                    <span>
                      Decoração <strong>encerrada</strong> em {formatDataHora(data.encerrada_em)}.
                      A lista abaixo é o registro final dos desfechos (somente leitura).
                    </span>
                  </div>
                )}

                {/* Trocar foto (quando sem override) — só com festa aberta */}
                {!isEncerrada && !fotoIsOverride && (
                  <div className="space-y-1.5">
                    <Label>Trocar foto na festa</Label>
                    <PhotoDropZone
                      bucket={FESTA_BUCKET}
                      folder={eventId}
                      maxFiles={1}
                      existingCount={0}
                      disabled={isMutating}
                      onUploadComplete={handleFotoUpload}
                    />
                    <p className="text-xs text-text-tertiary">
                      Sem foto própria, usa a foto modelo do tema. Salva ao clicar em Salvar.
                    </p>
                  </div>
                )}

                {/* Resumo read-only dos desfechos (festa encerrada) */}
                {isEncerrada && (
                  <div className="space-y-2">
                    <Label>Desfecho dos itens</Label>
                    <ul className="space-y-2">
                      {data.itens.map((l) => {
                        const desc = [l.tamanho, l.cor, l.detalhe].filter(Boolean).join(' / ') || l.codigo
                        const ocorrencias = l.qtd_quebrado + l.qtd_perdido + l.qtd_quarentena
                        return (
                          <li
                            key={l.variacao_id}
                            className="rounded-md border border-border-default bg-surface-primary p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{l.item_nome} — {desc}</p>
                                <p className="font-mono text-xs text-text-tertiary">{l.codigo} · {l.quantidade} {l.quantidade === 1 ? 'peça' : 'peças'}</p>
                              </div>
                              {ocorrencias === 0 ? (
                                <span className="flex shrink-0 items-center gap-1 text-xs text-green-600">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Tudo OK
                                </span>
                              ) : (
                                <span className="shrink-0 text-xs text-amber-600">
                                  {l.qtd_ok} ok
                                </span>
                              )}
                            </div>
                            {ocorrencias > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                                {l.qtd_quebrado > 0 && (
                                  <span className="rounded-full border border-border-default px-2 py-0.5 text-text-secondary">Quebrou: {l.qtd_quebrado}</span>
                                )}
                                {l.qtd_perdido > 0 && (
                                  <span className="rounded-full border border-border-default px-2 py-0.5 text-text-secondary">Sumiu: {l.qtd_perdido}</span>
                                )}
                                {l.qtd_quarentena > 0 && (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700">Quarentena: {l.qtd_quarentena}</span>
                                )}
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {/* Lista editável (festa aberta) */}
                {!isEncerrada && (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <Label>Itens da decoração</Label>
                    <span className="text-xs text-text-tertiary">
                      {itens.length} {itens.length === 1 ? 'item' : 'itens'} · {totalPecas} peças
                    </span>
                  </div>

                  {itens.length > 0 && (
                    <ul className="space-y-2">
                      {itens.map((linha) => {
                        const info = infoByVariacao.get(linha.variacao_id)
                        return (
                          <li
                            key={linha.variacao_id}
                            className="grid gap-2 rounded-md border border-border-default bg-surface-primary p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{info?.desc ?? '—'}</p>
                              <p className="font-mono text-xs text-text-tertiary">{info?.codigo ?? '—'}</p>
                            </div>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              value={linha.quantidade}
                              onChange={(e) => atualizarQuantidade(linha.variacao_id, e.target.value)}
                              className="w-24 text-right"
                              aria-label={`Quantidade de ${info?.desc ?? 'variação'}`}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => removerItem(linha.variacao_id)}
                              aria-label="Remover item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  {variacoesDisponiveis.length > 0 ? (
                    <Select value="" onValueChange={(v) => adicionarVariacao(v ?? '')}>
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
                              <span>{variacaoDesc(v)}</span>
                              <span className="font-mono text-xs text-text-tertiary">{v.codigo}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-xs text-text-tertiary">
                      {variacoesCatalog.length === 0
                        ? 'Nenhuma variação de item ativa no catálogo.'
                        : 'Todas as variações do catálogo já estão na lista.'}
                    </p>
                  )}
                </div>
                )}

                {/* Observações — editável (aberta) */}
                {!isEncerrada && (
                  <div className="space-y-1.5">
                    <Label htmlFor="festa-deco-obs">Observações</Label>
                    <Textarea
                      id="festa-deco-obs"
                      value={observacoes}
                      onChange={(e) => {
                        setObservacoes(e.target.value)
                        setDirty(true)
                      }}
                      rows={3}
                      placeholder="Notas da decoração desta festa…"
                    />
                  </div>
                )}

                {/* Observações — read-only (encerrada, se houver) */}
                {isEncerrada && data.observacoes && (
                  <div className="space-y-1.5">
                    <Label>Observações</Label>
                    <p className="whitespace-pre-wrap rounded-md border border-border-default bg-surface-primary p-3 text-sm text-text-secondary">
                      {data.observacoes}
                    </p>
                  </div>
                )}

                {/* Fotos da montagem (Bloco E) */}
                <div className="space-y-1.5">
                  <Label>Fotos da montagem</Label>
                  <FestaFotosGaleria
                    festaDecoracaoId={data.id}
                    isEncerrada={isEncerrada}
                    canEdit={canUse}
                  />
                </div>

                {/* Ações — festa encerrada (só romaneio) */}
                {isEncerrada && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-border-default pt-3">
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setRomaneioOpen(true)}>
                      <Printer className="w-3.5 h-3.5" />
                      Imprimir romaneio
                    </Button>
                  </div>
                )}

                {/* Ações — festa aberta */}
                {!isEncerrada && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-default pt-3">
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setRomaneioOpen(true)}>
                        <Printer className="w-3.5 h-3.5" />
                        Imprimir romaneio
                      </Button>
                      {canDelete && (
                        <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive" onClick={handleDesvincular} disabled={isMutating}>
                          <Trash2 className="w-3.5 h-3.5" />
                          Desvincular
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {dirty ? (
                        <>
                          <Button type="button" variant="outline" size="sm" onClick={handleCancelar} disabled={isMutating}>
                            Cancelar
                          </Button>
                          <Button type="button" size="sm" onClick={handleSalvar} disabled={!dirty || isMutating}>
                            {update.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                            Salvar
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => setEncerrarOpen(true)}
                          disabled={isMutating || itens.length === 0}
                        >
                          <Flag className="h-3.5 w-3.5" />
                          Encerrar decoração
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Dialog: picker de tema (primeiro vínculo OU re-vínculo destrutivo) */}
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{hasDecoracao ? 'Vincular outro tema' : 'Vincular tema'}</DialogTitle>
            <DialogDescription>
              {hasDecoracao
                ? 'Escolha um tema. A lista atual da festa será substituída pela receita do tema.'
                : 'Escolha um tema — a receita dele será puxada como lista de itens da festa.'}
            </DialogDescription>
          </DialogHeader>

          {hasDecoracao && (
            <div className="flex items-start gap-2 rounded-lg border border-status-warning-border bg-status-warning-bg px-3 py-2 text-xs text-status-warning-text">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Isto descarta as edições atuais da lista e da foto desta festa.</span>
            </div>
          )}

          <Select value={pickerTemaId} onValueChange={(v) => setPickerTemaId(v ?? '')}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {pickerTemaId
                  ? (temasAtivos.find((t) => t.id === pickerTemaId)?.nome ?? 'Tema')
                  : <span className="text-text-tertiary">Selecione um tema…</span>}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {temasAtivos.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPickerOpen(false)} disabled={vincular.isPending}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmPicker} disabled={!pickerTemaId || vincular.isPending}>
              {vincular.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {hasDecoracao ? 'Substituir' : 'Vincular'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Romaneio */}
      <FestaRomaneioPrintDialog open={romaneioOpen} onOpenChange={setRomaneioOpen} data={romaneioData} />

      {/* Encerramento item a item (Bloco D) */}
      {data && (
        <FestaEncerramentoDialog
          open={encerrarOpen}
          onOpenChange={setEncerrarOpen}
          festaId={data.id}
          eventId={eventId}
          unitName={unitName}
          itens={data.itens}
        />
      )}
    </div>
  )
}
