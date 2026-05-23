'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useCreateFornecedor, useUpdateFornecedor, useDeleteFornecedor } from '@/hooks/use-decoracao-fornecedores'
import { hasRole, DECORACAO_DELETE_ROLES } from '@/config/roles'
import { useAuth } from '@/hooks/use-auth'
import type { DecoracaoFornecedor, FornecedorFormInput } from '@/types/decoracao'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  fornecedor: DecoracaoFornecedor | null
  createMode: boolean
}

const EMPTY: FornecedorFormInput = {
  nome: '',
  telefone: null,
  email: null,
  fornece: null,
  documento: null,
  observacoes: null,
  ativo: true,
}

export function FornecedorEditSheet({ open, onOpenChange, fornecedor, createMode }: Props) {
  const { profile } = useAuth()
  const canDelete = hasRole(profile?.role, DECORACAO_DELETE_ROLES)

  const createMutation = useCreateFornecedor()
  const updateMutation = useUpdateFornecedor()
  const deleteMutation = useDeleteFornecedor()

  const [form, setForm] = useState<FornecedorFormInput>(EMPTY)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect -- sincroniza props→form ao abrir */
    setDeleteConfirm(false)
    if (createMode) {
      setForm(EMPTY)
    } else if (fornecedor) {
      setForm({
        nome: fornecedor.nome,
        telefone: fornecedor.telefone,
        email: fornecedor.email,
        fornece: fornecedor.fornece,
        documento: fornecedor.documento,
        observacoes: fornecedor.observacoes,
        ativo: fornecedor.ativo,
      })
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, createMode, fornecedor?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  function set<K extends keyof FornecedorFormInput>(key: K, value: FornecedorFormInput[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: FornecedorFormInput = {
      ...form,
      nome: form.nome.trim(),
      telefone: form.telefone?.trim() || null,
      email: form.email?.trim() || null,
      fornece: form.fornece?.trim() || null,
      documento: form.documento?.trim() || null,
      observacoes: form.observacoes?.trim() || null,
    }
    try {
      if (createMode) {
        await createMutation.mutateAsync(payload)
      } else {
        await updateMutation.mutateAsync({ id: fornecedor!.id, input: payload })
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
    await deleteMutation.mutateAsync(fornecedor!.id)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {createMode ? 'Novo fornecedor' : 'Editar fornecedor'}
          </SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5 px-1">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="forn-nome">Nome *</Label>
            <Input
              id="forn-nome"
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="Ex.: Balões do João"
              required
            />
          </div>

          {/* Telefone + E-mail */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="forn-tel">Telefone</Label>
              <Input
                id="forn-tel"
                value={form.telefone ?? ''}
                onChange={(e) => set('telefone', e.target.value || null)}
                placeholder="(11) 99999-9999"
                inputMode="tel"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="forn-email">E-mail</Label>
              <Input
                id="forn-email"
                type="email"
                value={form.email ?? ''}
                onChange={(e) => set('email', e.target.value || null)}
                placeholder="contato@exemplo.com"
              />
            </div>
          </div>

          {/* O que fornece */}
          <div className="space-y-1.5">
            <Label htmlFor="forn-fornece">O que fornece</Label>
            <Input
              id="forn-fornece"
              value={form.fornece ?? ''}
              onChange={(e) => set('fornece', e.target.value || null)}
              placeholder="Ex.: Balões, arranjos, arcos…"
            />
          </div>

          {/* Documento */}
          <div className="space-y-1.5">
            <Label htmlFor="forn-doc">CNPJ / CPF</Label>
            <Input
              id="forn-doc"
              value={form.documento ?? ''}
              onChange={(e) => set('documento', e.target.value || null)}
              placeholder="Opcional"
            />
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label htmlFor="forn-obs">Observações</Label>
            <Textarea
              id="forn-obs"
              value={form.observacoes ?? ''}
              onChange={(e) => set('observacoes', e.target.value || null)}
              rows={3}
              placeholder="Notas internas sobre este fornecedor…"
            />
          </div>

          {/* Ativo */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Ativo</p>
              <p className="text-xs text-muted-foreground">
                Fornecedores inativos ficam ocultos por padrão.
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
