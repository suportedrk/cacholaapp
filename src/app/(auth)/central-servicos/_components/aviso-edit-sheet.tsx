'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
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
import { DateInput } from '@/components/ui/date-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useCreateAviso,
  useUpdateAviso,
  useDeleteAviso,
} from '@/hooks/use-central-servicos-avisos'
import {
  AVISO_CATEGORIAS,
  AVISO_CATEGORIA_LABELS,
  AVISO_PRIORIDADES,
  AVISO_PRIORIDADE_LABELS,
  CONTATO_UNIDADES,
  CONTATO_UNIDADE_LABELS,
  type CentralServicosAviso,
  type AvisoFormInput,
  type AvisoCategoria,
  type AvisoPrioridade,
  type ContatoUnidade,
} from '@/types/central-servicos'

interface FormState {
  titulo: string
  conteudo: string
  categoria: AvisoCategoria
  prioridade: AvisoPrioridade
  unidade: ContatoUnidade
  publicadoData: string // yyyy-mm-dd
  expiraData: string // yyyy-mm-dd | ''
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

  const [form, setForm] = useState<FormState>(EMPTY)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect -- sincroniza props→form ao abrir */
    setDeleteConfirm(false)
    if (createMode || !aviso) {
      setForm(EMPTY())
    } else {
      setForm({
        titulo: aviso.titulo,
        conteudo: aviso.conteudo,
        categoria: aviso.categoria,
        prioridade: aviso.prioridade,
        unidade: aviso.unidade,
        publicadoData: isoToDate(aviso.publicado_em),
        expiraData: isoToDate(aviso.expira_em),
      })
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, createMode, aviso?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

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
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    try {
      if (createMode) {
        await createMutation.mutateAsync(buildPayload())
      } else {
        await updateMutation.mutateAsync({ id: aviso!.id, input: buildPayload() })
      }
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
      await deleteMutation.mutateAsync(aviso!.id)
    } catch {
      return
    }
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
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
