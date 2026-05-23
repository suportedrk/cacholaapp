'use client'

import { useEffect, useState } from 'react'
import { Trash2, ImageOff } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useCreateBalaoModelo, useUpdateBalaoModelo, useDeleteBalaoModelo } from '@/hooks/use-decoracao'
import { hasRole } from '@/config/roles'
import { DECORACAO_DELETE_ROLES } from '@/config/roles'
import { useAuth } from '@/hooks/use-auth'
import type { DecoracaoBalaoModelo, BalaoModeloFormInput } from '@/types/decoracao'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  modelo: DecoracaoBalaoModelo | null
  createMode: boolean
}

const EMPTY: BalaoModeloFormInput = {
  nome: '',
  categoria: null,
  custo: null,
  valor_venda: null,
  ativo: true,
  observacoes: null,
}

function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9,.\-]/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) || n < 0 ? null : n
}

function moneyDisplay(v: number | null): string {
  if (v === null) return ''
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function BalaoEditSheet({ open, onOpenChange, modelo, createMode }: Props) {
  const { profile } = useAuth()
  const canDelete = hasRole(profile?.role, DECORACAO_DELETE_ROLES)

  const createMutation = useCreateBalaoModelo()
  const updateMutation = useUpdateBalaoModelo()
  const deleteMutation = useDeleteBalaoModelo()

  const [form, setForm] = useState<BalaoModeloFormInput>(EMPTY)
  const [custoRaw, setCustoRaw] = useState('')
  const [vendaRaw, setVendaRaw] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect -- sincroniza props→form ao abrir */
    setDeleteConfirm(false)
    if (createMode) {
      setForm(EMPTY)
      setCustoRaw('')
      setVendaRaw('')
    } else if (modelo) {
      setForm({
        nome: modelo.nome,
        categoria: modelo.categoria,
        custo: modelo.custo,
        valor_venda: modelo.valor_venda,
        ativo: modelo.ativo,
        observacoes: modelo.observacoes,
      })
      setCustoRaw(moneyDisplay(modelo.custo))
      setVendaRaw(moneyDisplay(modelo.valor_venda))
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, createMode, modelo?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const isPending =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

  function close() {
    onOpenChange(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: BalaoModeloFormInput = {
      ...form,
      custo: parseMoney(custoRaw),
      valor_venda: parseMoney(vendaRaw),
    }
    if (createMode) {
      await createMutation.mutateAsync(payload)
    } else {
      await updateMutation.mutateAsync({ id: modelo!.id, input: payload })
    }
    close()
  }

  async function handleDelete() {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }
    await deleteMutation.mutateAsync(modelo!.id)
    close()
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{createMode ? 'Novo modelo de balão' : 'Editar modelo'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5 px-1">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="balao-nome">Nome *</Label>
            <Input
              id="balao-nome"
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex.: Meio arco + complemento"
              required
            />
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <Label htmlFor="balao-categoria">Categoria</Label>
            <Input
              id="balao-categoria"
              value={form.categoria ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, categoria: e.target.value || null }))
              }
              placeholder="Opcional"
            />
          </div>

          {/* Custo e Valor de venda */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="balao-custo">Custo (R$)</Label>
              <Input
                id="balao-custo"
                value={custoRaw}
                onChange={(e) => setCustoRaw(e.target.value)}
                onBlur={() => {
                  const n = parseMoney(custoRaw)
                  setCustoRaw(n !== null ? moneyDisplay(n) : '')
                }}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="balao-venda">Valor de venda (R$)</Label>
              <Input
                id="balao-venda"
                value={vendaRaw}
                onChange={(e) => setVendaRaw(e.target.value)}
                onBlur={() => {
                  const n = parseMoney(vendaRaw)
                  setVendaRaw(n !== null ? moneyDisplay(n) : '')
                }}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>
          </div>

          {/* Foto — placeholder */}
          <div className="space-y-1.5">
            <Label>Foto</Label>
            <div className="flex h-20 items-center justify-center gap-2 rounded-md border border-dashed text-sm text-muted-foreground">
              <ImageOff className="h-4 w-4" />
              Foto — em breve
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label htmlFor="balao-obs">Observações</Label>
            <Textarea
              id="balao-obs"
              value={form.observacoes ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, observacoes: e.target.value || null }))
              }
              rows={3}
              placeholder="Notas internas sobre este modelo..."
            />
          </div>

          {/* Ativo */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Ativo</p>
              <p className="text-xs text-muted-foreground">
                Modelos inativos ficam ocultos por padrão na lista.
              </p>
            </div>
            <Switch
              checked={form.ativo}
              onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))}
            />
          </div>

          <SheetFooter className="flex-col gap-2 pt-2 sm:flex-row sm:justify-between">
            {/* Excluir */}
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
              <Button type="button" variant="outline" onClick={close} disabled={isPending}>
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
