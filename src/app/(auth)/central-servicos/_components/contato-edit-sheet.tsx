'use client'

import { useEffect, useRef, useState } from 'react'
import { Trash2, X } from 'lucide-react'
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
import { PhotoDropZone } from '@/components/shared/photo-upload'
import { createClient } from '@/lib/supabase/client'
import { useSignedUrls } from '@/hooks/use-signed-urls'
import { ContatoAvatar } from './contato-avatar'
import {
  useCreateContato,
  useUpdateContato,
  useDeleteContato,
} from '@/hooks/use-central-servicos-contatos'
import {
  CONTATO_UNIDADES,
  CONTATO_UNIDADE_LABELS,
  CONTATOS_BUCKET,
  type CentralServicosContato,
  type ContatoFormInput,
  type ContatoUnidade,
} from '@/types/central-servicos'

const EMPTY: ContatoFormInput = {
  nome: '',
  setor: null,
  cargo: null,
  unidade: 'geral',
  email: null,
  telefone: null,
  foto_path: null,
  ativo: true,
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  contato: CentralServicosContato | null
  createMode: boolean
  canDelete: boolean
}

export function ContatoEditSheet({ open, onOpenChange, contato, createMode, canDelete }: Props) {
  const createMutation = useCreateContato()
  const updateMutation = useUpdateContato()
  const deleteMutation = useDeleteContato()

  const [form, setForm] = useState<ContatoFormInput>(EMPTY)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  // Fotos enviadas nesta sessão e ainda não persistidas (limpas se cancelar).
  const pendingUploads = useRef<string[]>([])

  function set<K extends keyof ContatoFormInput>(key: K, value: ContatoFormInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect -- sincroniza props→form ao abrir */
    setDeleteConfirm(false)
    pendingUploads.current = []
    if (createMode || !contato) {
      setForm(EMPTY)
    } else {
      setForm({
        nome: contato.nome,
        setor: contato.setor,
        cargo: contato.cargo,
        unidade: contato.unidade,
        email: contato.email,
        telefone: contato.telefone,
        foto_path: contato.foto_path,
        ativo: contato.ativo,
      })
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, createMode, contato?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Preview da foto atual (signed URL do bucket privado).
  const fotoPaths = form.foto_path ? [form.foto_path] : []
  const { data: signedUrls = {} } = useSignedUrls(CONTATOS_BUCKET, fotoPaths)

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  async function removeFromStorage(paths: string[]) {
    if (paths.length === 0) return
    try {
      await createClient().storage.from(CONTATOS_BUCKET).remove(paths)
    } catch {
      // fire-and-forget
    }
  }

  function handleUploadComplete(path: string): Promise<void> {
    pendingUploads.current = [...pendingUploads.current, path]
    set('foto_path', path)
    return Promise.resolve()
  }

  function handleRemovePhoto() {
    const current = form.foto_path
    // Só apaga do storage imediatamente se for um upload pendente desta sessão.
    if (current && pendingUploads.current.includes(current)) {
      void removeFromStorage([current])
      pendingUploads.current = pendingUploads.current.filter((p) => p !== current)
    }
    set('foto_path', null)
  }

  async function close(saved: boolean) {
    if (!saved && pendingUploads.current.length > 0) {
      await removeFromStorage(pendingUploads.current)
    }
    pendingUploads.current = []
    onOpenChange(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: ContatoFormInput = {
      ...form,
      nome: form.nome.trim(),
      setor: form.setor?.trim() || null,
      cargo: form.cargo?.trim() || null,
      email: form.email?.trim() || null,
      telefone: form.telefone?.trim() || null,
    }
    try {
      if (createMode) {
        await createMutation.mutateAsync(payload)
      } else {
        await updateMutation.mutateAsync({ id: contato!.id, input: payload })
      }
    } catch {
      return
    }
    pendingUploads.current = []
    onOpenChange(false)
  }

  async function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    try {
      await deleteMutation.mutateAsync(contato!.id)
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
          <SheetTitle>{createMode ? 'Novo contato' : 'Editar contato'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5 px-1">
          {/* Foto */}
          <div className="space-y-2">
            <Label>Foto</Label>
            {form.foto_path ? (
              <div className="flex items-center gap-3">
                <ContatoAvatar src={signedUrls[form.foto_path]} nome={form.nome || 'Contato'} size={64} />
                <Button type="button" variant="outline" size="sm" onClick={handleRemovePhoto}>
                  <X className="mr-1.5 h-4 w-4" />
                  Remover foto
                </Button>
              </div>
            ) : (
              <PhotoDropZone
                bucket={CONTATOS_BUCKET}
                folder="contatos"
                maxFiles={1}
                onUploadComplete={handleUploadComplete}
              />
            )}
          </div>

          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="contato-nome">Nome *</Label>
            <Input
              id="contato-nome"
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="Nome completo"
              required
            />
          </div>

          {/* Setor + Cargo */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="contato-setor">Setor</Label>
              <Input
                id="contato-setor"
                value={form.setor ?? ''}
                onChange={(e) => set('setor', e.target.value)}
                placeholder="Ex.: RH, Financeiro…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="contato-cargo">Cargo</Label>
              <Input
                id="contato-cargo"
                value={form.cargo ?? ''}
                onChange={(e) => set('cargo', e.target.value)}
                placeholder="Ex.: Analista"
              />
            </div>
          </div>

          {/* Unidade */}
          <div className="space-y-1.5">
            <Label htmlFor="contato-unidade">Unidade</Label>
            <Select
              value={form.unidade}
              onValueChange={(v) => set('unidade', v as ContatoUnidade)}
            >
              <SelectTrigger id="contato-unidade" className="w-full">
                <SelectValue>{CONTATO_UNIDADE_LABELS[form.unidade]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CONTATO_UNIDADES.map((u) => (
                  <SelectItem key={u} value={u}>
                    {CONTATO_UNIDADE_LABELS[u]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* E-mail + Telefone */}
          <div className="space-y-1.5">
            <Label htmlFor="contato-email">E-mail</Label>
            <Input
              id="contato-email"
              type="email"
              value={form.email ?? ''}
              onChange={(e) => set('email', e.target.value)}
              placeholder="email@cachola.cloud"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contato-telefone">Telefone</Label>
            <Input
              id="contato-telefone"
              value={form.telefone ?? ''}
              onChange={(e) => set('telefone', e.target.value)}
              placeholder="(11) 99999-9999"
            />
            <p className="text-xs text-muted-foreground">
              Usado para o botão de WhatsApp.
            </p>
          </div>

          {/* Ativo */}
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Ativo</p>
              <p className="text-xs text-muted-foreground">
                Ao sair da empresa, desative — o contato some para todos (não exclua).
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
              <Button type="button" variant="outline" onClick={() => void close(false)} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending || !form.nome.trim()}>
                {isPending ? 'Salvando…' : createMode ? 'Criar' : 'Salvar'}
              </Button>
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
