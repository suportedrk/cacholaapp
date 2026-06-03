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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useCreateLink,
  useUpdateLink,
  useDeleteLink,
} from '@/hooks/use-central-servicos-links'
import {
  LINK_CATEGORIAS,
  LINK_CATEGORIA_LABELS,
  type CentralServicosLink,
  type LinkFormInput,
  type LinkCategoria,
} from '@/types/central-servicos'

const EMPTY: LinkFormInput = {
  nome: '',
  descricao: null,
  categoria: 'outros',
  url: '',
  icone_url: null,
  ativo: true,
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  link: CentralServicosLink | null
  createMode: boolean
  canDelete: boolean
}

export function LinkEditSheet({ open, onOpenChange, link, createMode, canDelete }: Props) {
  const createMutation = useCreateLink()
  const updateMutation = useUpdateLink()
  const deleteMutation = useDeleteLink()

  const [form, setForm] = useState<LinkFormInput>(EMPTY)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  function set<K extends keyof LinkFormInput>(key: K, value: LinkFormInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect -- sincroniza props→form ao abrir */
    setDeleteConfirm(false)
    if (createMode || !link) {
      setForm(EMPTY)
    } else {
      setForm({
        nome: link.nome,
        descricao: link.descricao,
        categoria: link.categoria,
        url: link.url,
        icone_url: link.icone_url,
        ativo: link.ativo,
      })
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, createMode, link?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: LinkFormInput = {
      ...form,
      nome: form.nome.trim(),
      url: form.url.trim(),
      descricao: form.descricao?.trim() || null,
      icone_url: form.icone_url?.trim() || null,
    }
    try {
      if (createMode) {
        await createMutation.mutateAsync(payload)
      } else {
        await updateMutation.mutateAsync({ id: link!.id, input: payload })
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
      await deleteMutation.mutateAsync(link!.id)
    } catch {
      return
    }
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{createMode ? 'Novo link' : 'Editar link'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5 px-1">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="link-nome">Nome *</Label>
            <Input
              id="link-nome"
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="Ex.: Ploomes, Portal RH…"
              required
            />
          </div>

          {/* URL */}
          <div className="space-y-1.5">
            <Label htmlFor="link-url">URL *</Label>
            <Input
              id="link-url"
              type="url"
              value={form.url}
              onChange={(e) => set('url', e.target.value)}
              placeholder="https://…"
              required
            />
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label htmlFor="link-categoria">Categoria *</Label>
            <Select
              value={form.categoria}
              onValueChange={(v) => set('categoria', v as LinkCategoria)}
            >
              <SelectTrigger id="link-categoria" className="w-full">
                <SelectValue>{LINK_CATEGORIA_LABELS[form.categoria]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {LINK_CATEGORIAS.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {LINK_CATEGORIA_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label htmlFor="link-descricao">Descrição</Label>
            <Input
              id="link-descricao"
              value={form.descricao ?? ''}
              onChange={(e) => set('descricao', e.target.value)}
              placeholder="Breve descrição (opcional)"
            />
          </div>

          {/* Ícone (override) */}
          <div className="space-y-1.5">
            <Label htmlFor="link-icone">URL do ícone</Label>
            <Input
              id="link-icone"
              type="url"
              value={form.icone_url ?? ''}
              onChange={(e) => set('icone_url', e.target.value)}
              placeholder="Opcional — vazio usa o favicon do site"
            />
            <p className="text-xs text-muted-foreground">
              Deixe vazio para buscar o ícone do site automaticamente.
            </p>
          </div>

          {/* Ativo */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Ativo</p>
              <p className="text-xs text-muted-foreground">
                Links inativos ficam ocultos para quem só visualiza.
              </p>
            </div>
            <Switch checked={form.ativo} onCheckedChange={(v) => set('ativo', v)} />
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
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || !form.nome.trim() || !form.url.trim()}>
                {isPending ? 'Salvando…' : createMode ? 'Criar' : 'Salvar'}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
