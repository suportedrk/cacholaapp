'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useCreateLocal, useUpdateLocal, useDeleteLocal } from '@/hooks/use-decoracao-locais'
import { hasRole, DECORACAO_DELETE_ROLES } from '@/config/roles'
import { useAuth } from '@/hooks/use-auth'
import type { DecoracaoLocal, LocalFormInput } from '@/types/decoracao'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  local: DecoracaoLocal | null
  createMode: boolean
}

const EMPTY: LocalFormInput = {
  nome: '',
  observacoes: null,
  ativo: true,
}

export function LocalEditSheet({ open, onOpenChange, local, createMode }: Props) {
  const { profile } = useAuth()
  const canDelete = hasRole(profile?.role, DECORACAO_DELETE_ROLES)

  const createMutation = useCreateLocal()
  const updateMutation = useUpdateLocal()
  const deleteMutation = useDeleteLocal()

  const [form, setForm] = useState<LocalFormInput>(EMPTY)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect -- sincroniza props→form ao abrir */
    setDeleteConfirm(false)
    if (createMode) {
      setForm(EMPTY)
    } else if (local) {
      setForm({
        nome: local.nome,
        observacoes: local.observacoes,
        ativo: local.ativo,
      })
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, createMode, local?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  function set<K extends keyof LocalFormInput>(key: K, value: LocalFormInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: LocalFormInput = {
      ...form,
      nome: form.nome.trim(),
      observacoes: form.observacoes?.trim() || null,
    }
    try {
      if (createMode) {
        await createMutation.mutateAsync(payload)
      } else {
        await updateMutation.mutateAsync({ id: local!.id, input: payload })
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
    await deleteMutation.mutateAsync(local!.id)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {createMode ? 'Novo local' : 'Editar local'}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5 px-1">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="local-nome">Nome *</Label>
            <Input
              id="local-nome"
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="Ex.: Pinheiros, Depósito 1…"
              required
            />
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label htmlFor="local-obs">Observações</Label>
            <Textarea
              id="local-obs"
              value={form.observacoes ?? ''}
              onChange={(e) => set('observacoes', e.target.value || null)}
              rows={3}
              placeholder="Notas internas sobre este local…"
            />
          </div>

          {/* Ativo */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Ativo</p>
              <p className="text-xs text-muted-foreground">
                Locais inativos ficam ocultos por padrão.
              </p>
            </div>
            <Switch
              checked={form.ativo}
              onCheckedChange={(v) => set('ativo', v)}
            />
          </div>

          <SheetFooter className="flex-col gap-2 pt-2 sm:flex-row sm:justify-between">
            {/* Excluir permanentemente — apenas DECORACAO_DELETE_ROLES */}
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
