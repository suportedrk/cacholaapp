'use client'

import { useEffect, useRef, useState } from 'react'
import { Trash2, FileText, ImageIcon, X } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { DateInput } from '@/components/ui/date-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileDropZone, type UploadedFileMeta } from '@/components/shared/file-upload'
import { createClient } from '@/lib/supabase/client'
import {
  useCreateAviso,
  useUpdateAviso,
  useDeleteAviso,
  useAddAvisoAnexo,
  useRemoveAvisoAnexo,
} from '@/hooks/use-central-servicos-avisos'
import {
  AVISO_CATEGORIAS,
  AVISO_CATEGORIA_LABELS,
  AVISO_PRIORIDADES,
  AVISO_PRIORIDADE_LABELS,
  CONTATO_UNIDADES,
  CONTATO_UNIDADE_LABELS,
  AVISOS_ANEXOS_BUCKET,
  AVISO_ANEXO_MIME_TYPES,
  AVISO_ANEXO_MAX_BYTES,
  type CentralServicosAviso,
  type AvisoFormInput,
  type AvisoCategoria,
  type AvisoPrioridade,
  type ContatoUnidade,
} from '@/types/central-servicos'

/** Item de anexo no formulário: pode ser persistido (id) ou recém-enviado (sem id). */
interface LocalAnexo {
  id?: string
  storage_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
}

function formatBytes(n: number | null): string {
  if (!n) return ''
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

interface FormState {
  titulo: string
  conteudo: string
  categoria: AvisoCategoria
  prioridade: AvisoPrioridade
  unidade: ContatoUnidade
  publicadoData: string // yyyy-mm-dd
  expiraData: string // yyyy-mm-dd | ''
  exigeConfirmacao: boolean
}

/** ISO → yyyy-mm-dd (data local). */
function isoToDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function todayDate(): string {
  return isoToDate(new Date().toISOString())
}

const EMPTY = (): FormState => ({
  titulo: '',
  conteudo: '',
  categoria: 'informativo',
  prioridade: 'normal',
  unidade: 'geral',
  publicadoData: todayDate(),
  expiraData: '',
  exigeConfirmacao: false,
})

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  aviso: CentralServicosAviso | null
  createMode: boolean
  canDelete: boolean
}

export function AvisoEditSheet({ open, onOpenChange, aviso, createMode, canDelete }: Props) {
  const createMutation = useCreateAviso()
  const updateMutation = useUpdateAviso()
  const deleteMutation = useDeleteAviso()
  const addAnexo = useAddAvisoAnexo()
  const removeAnexo = useRemoveAvisoAnexo()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  // Anexos: lista local (persistidos têm id; recém-enviados não).
  const [anexos, setAnexos] = useState<LocalAnexo[]>([])
  // storage_paths enviados nesta sessão e ainda não vinculados (limpar se cancelar).
  const pendingUploads = useRef<string[]>([])
  // ids de anexos persistidos que o usuário removeu (apagar ao salvar).
  const removedExistingIds = useRef<string[]>([])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect -- sincroniza props→form ao abrir */
    setDeleteConfirm(false)
    pendingUploads.current = []
    removedExistingIds.current = []
    if (createMode || !aviso) {
      setForm(EMPTY())
      setAnexos([])
    } else {
      setForm({
        titulo: aviso.titulo,
        conteudo: aviso.conteudo,
        categoria: aviso.categoria,
        prioridade: aviso.prioridade,
        unidade: aviso.unidade,
        publicadoData: isoToDate(aviso.publicado_em),
        expiraData: isoToDate(aviso.expira_em),
        exigeConfirmacao: aviso.exige_confirmacao,
      })
      setAnexos(
        (aviso.anexos ?? []).map((a) => ({
          id: a.id,
          storage_path: a.storage_path,
          file_name: a.file_name,
          mime_type: a.mime_type,
          size_bytes: a.size_bytes,
        })),
      )
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, createMode, aviso?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending ||
    addAnexo.isPending || removeAnexo.isPending

  async function removeFromStorage(paths: string[]) {
    if (paths.length === 0) return
    try {
      await createClient().storage.from(AVISOS_ANEXOS_BUCKET).remove(paths)
    } catch {
      // fire-and-forget
    }
  }

  function handleUploaded(meta: UploadedFileMeta) {
    pendingUploads.current = [...pendingUploads.current, meta.storage_path]
    setAnexos((prev) => [...prev, { ...meta }])
  }

  function handleRemoveAnexo(item: LocalAnexo) {
    setAnexos((prev) => prev.filter((a) => a.storage_path !== item.storage_path))
    if (item.id) {
      // persistido → apaga ao salvar
      removedExistingIds.current = [...removedExistingIds.current, item.id]
    } else {
      // upload pendente desta sessão → apaga do storage agora
      void removeFromStorage([item.storage_path])
      pendingUploads.current = pendingUploads.current.filter((p) => p !== item.storage_path)
    }
  }

  /** Vincula novos anexos e apaga os removidos, contra um aviso já existente. */
  async function reconcileAnexos(avisoId: string) {
    const toAdd = anexos.filter((a) => !a.id)
    await Promise.all([
      ...toAdd.map((a) =>
        addAnexo.mutateAsync({
          avisoId,
          meta: {
            storage_path: a.storage_path,
            file_name: a.file_name,
            mime_type: a.mime_type,
            size_bytes: a.size_bytes,
          },
        }),
      ),
      ...removedExistingIds.current.map((anexoId) =>
        removeAnexo.mutateAsync({ avisoId, anexoId }),
      ),
    ])
    // vinculados com sucesso → não limpar do storage
    pendingUploads.current = []
    removedExistingIds.current = []
  }

  async function close(saved: boolean) {
    if (!saved && pendingUploads.current.length > 0) {
      await removeFromStorage(pendingUploads.current)
    }
    pendingUploads.current = []
    removedExistingIds.current = []
    onOpenChange(false)
  }

  function buildPayload(): AvisoFormInput {
    return {
      titulo: form.titulo.trim(),
      conteudo: form.conteudo.trim(),
      categoria: form.categoria,
      prioridade: form.prioridade,
      unidade: form.unidade,
      // início do dia para publicação; fim do dia para expiração (inclusivo).
      publicado_em: new Date(`${form.publicadoData || todayDate()}T00:00:00`).toISOString(),
      expira_em: form.expiraData ? new Date(`${form.expiraData}T23:59:59`).toISOString() : null,
      exige_confirmacao: form.exigeConfirmacao,
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      let avisoId: string
      if (createMode) {
        avisoId = await createMutation.mutateAsync(buildPayload())
      } else {
        avisoId = aviso!.id
        await updateMutation.mutateAsync({ id: avisoId, input: buildPayload() })
      }
      await reconcileAnexos(avisoId)
    } catch {
      return
    }
    onOpenChange(false)
  }

  async function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    try {
      // Apagar o aviso cascateia os anexos (FK ON DELETE CASCADE) — sem reconcile.
      await deleteMutation.mutateAsync(aviso!.id)
    } catch {
      return
    }
    pendingUploads.current = []
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) void close(false); else onOpenChange(true) }}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{createMode ? 'Novo aviso' : 'Editar aviso'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5 px-1">
          {/* Título */}
          <div className="space-y-1.5">
            <Label htmlFor="aviso-titulo">Título *</Label>
            <Input
              id="aviso-titulo"
              value={form.titulo}
              onChange={(e) => set('titulo', e.target.value)}
              placeholder="Ex.: Manutenção do sistema"
              required
            />
          </div>

          {/* Conteúdo */}
          <div className="space-y-1.5">
            <Label htmlFor="aviso-conteudo">Conteúdo *</Label>
            <Textarea
              id="aviso-conteudo"
              value={form.conteudo}
              onChange={(e) => set('conteudo', e.target.value)}
              placeholder="Detalhe o aviso…"
              rows={5}
              required
            />
          </div>

          {/* Categoria + Prioridade */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="aviso-categoria">Categoria *</Label>
              <Select value={form.categoria} onValueChange={(v) => set('categoria', v as AvisoCategoria)}>
                <SelectTrigger id="aviso-categoria" className="w-full">
                  <SelectValue>{AVISO_CATEGORIA_LABELS[form.categoria]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {AVISO_CATEGORIAS.map((c) => (
                    <SelectItem key={c} value={c}>{AVISO_CATEGORIA_LABELS[c]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aviso-prioridade">Prioridade</Label>
              <Select value={form.prioridade} onValueChange={(v) => set('prioridade', v as AvisoPrioridade)}>
                <SelectTrigger id="aviso-prioridade" className="w-full">
                  <SelectValue>{AVISO_PRIORIDADE_LABELS[form.prioridade]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {AVISO_PRIORIDADES.map((p) => (
                    <SelectItem key={p} value={p}>{AVISO_PRIORIDADE_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Unidade */}
          <div className="space-y-1.5">
            <Label htmlFor="aviso-unidade">Unidade</Label>
            <Select value={form.unidade} onValueChange={(v) => set('unidade', v as ContatoUnidade)}>
              <SelectTrigger id="aviso-unidade" className="w-full">
                <SelectValue>{CONTATO_UNIDADE_LABELS[form.unidade]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CONTATO_UNIDADES.map((u) => (
                  <SelectItem key={u} value={u}>{CONTATO_UNIDADE_LABELS[u]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Publicação + Expiração */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="aviso-publicado">Publicar em</Label>
              <DateInput
                id="aviso-publicado"
                value={form.publicadoData}
                onChange={(v) => set('publicadoData', v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aviso-expira">Expira em</Label>
              <DateInput
                id="aviso-expira"
                value={form.expiraData}
                onChange={(v) => set('expiraData', v)}
              />
              <p className="text-xs text-muted-foreground">Vazio = nunca expira.</p>
            </div>
          </div>

          {/* Exige confirmação de leitura */}
          <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
            <div className="min-w-0">
              <Label htmlFor="aviso-exige-confirmacao" className="cursor-pointer">
                Exige confirmação de leitura
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Mostra o botão &quot;Confirmo que li&quot; e registra quem confirmou.
              </p>
            </div>
            <Switch
              id="aviso-exige-confirmacao"
              checked={form.exigeConfirmacao}
              onCheckedChange={(v) => set('exigeConfirmacao', v)}
            />
          </div>

          {/* Anexos */}
          <div className="space-y-2">
            <Label>Anexos</Label>
            {anexos.length > 0 && (
              <ul className="space-y-1.5">
                {anexos.map((a) => {
                  const isPdf = a.mime_type === 'application/pdf'
                  return (
                    <li
                      key={a.storage_path}
                      className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5"
                    >
                      {isPdf
                        ? <FileText className="h-4 w-4 shrink-0 text-red-500" />
                        : <ImageIcon className="h-4 w-4 shrink-0 text-blue-500" />}
                      <span className="min-w-0 flex-1 truncate text-sm">{a.file_name}</span>
                      {a.size_bytes ? (
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {formatBytes(a.size_bytes)}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleRemoveAnexo(a)}
                        disabled={isPending}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
                        aria-label={`Remover ${a.file_name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <FileDropZone
              bucket={AVISOS_ANEXOS_BUCKET}
              folder="avisos"
              accept=".pdf,image/jpeg,image/png,image/webp"
              allowedMime={AVISO_ANEXO_MIME_TYPES}
              maxBytes={AVISO_ANEXO_MAX_BYTES}
              disabled={isPending}
              onUploaded={handleUploaded}
            />
          </div>

          <SheetFooter className="flex-col gap-2 pt-2 sm:flex-row sm:justify-between">
            {!createMode && canDelete && (
              <Button
                type="button"
                variant={deleteConfirm ? 'destructive' : 'outline'}
                size="sm"
                disabled={isPending}
                onClick={handleDelete}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                {deleteConfirm ? 'Confirmar exclusão' : 'Excluir'}
              </Button>
            )}
            <div className="flex gap-2 sm:ml-auto">
              <Button type="button" variant="outline" onClick={() => void close(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || !form.titulo.trim() || !form.conteudo.trim()}>
                {isPending ? 'Salvando…' : createMode ? 'Publicar' : 'Salvar'}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
