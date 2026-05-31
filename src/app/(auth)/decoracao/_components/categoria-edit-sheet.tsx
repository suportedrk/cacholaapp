'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useCreateCategoria, useUpdateCategoria, useDeleteCategoria } from '@/hooks/use-decoracao-categorias'
import { hasRole, DECORACAO_DELETE_ROLES } from '@/config/roles'
import { useAuth } from '@/hooks/use-auth'
import type { DecoracaoCategoria, CategoriaFormInput } from '@/types/decoracao'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  categoria: DecoracaoCategoria | null
  createMode: boolean
}

const EMPTY: CategoriaFormInput = {
  nome: '',
  ativo: true,
}

export function CategoriaEditSheet({ open, onOpenChange, categoria, createMode }: Props) {
  const { profile } = useAuth()
  // Decisão consciente (Aprendizado 10): visibilidade do botão de excluir
  // permanece via hasRole enquanto hook self-scoped não existir.
  // O ENFORCE real é feito pela API via requirePermissionApi('decoracao','delete').
  const canDelete = hasRole(profile?.role, DECORACAO_DELETE_ROLES)

  const createMutation = useCreateCategoria()
  const updateMutation = useUpdateCategoria()
  const deleteMutation = useDeleteCategoria()

  const [form, setForm] = useState<CategoriaFormInput>(EMPTY)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect -- sincroniza props→form ao abrir */
    setDeleteConfirm(false)
    if (createMode) {
      setForm(EMPTY)
    } else if (categoria) {
      setForm({ nome: categoria.nome, ativo: categoria.ativo })
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, createMode, categoria?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  function set<K extends keyof CategoriaFormInput>(key: K, value: CategoriaFormInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: CategoriaFormInput = { ...form, nome: form.nome.trim() }
    try {
      if (createMode) {
        await createMutation.mutateAsync(payload)
      } else {
        await updateMutation.mutateAsync({ id: categoria!.id, input: payload })
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
    await deleteMutation.mutateAsync(categoria!.id)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {createMode ? 'Nova categoria' : 'Editar categoria'}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5 px-1">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="cat-nome">Nome *</Label>
            <Input
              id="cat-nome"
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="Ex.: Balões, Mobiliário…"
              required
            />
          </div>

          {/* Ativo */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Ativo</p>
              <p className="text-xs text-muted-foreground">
                Categorias inativas ficam ocultas por padrão.
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
