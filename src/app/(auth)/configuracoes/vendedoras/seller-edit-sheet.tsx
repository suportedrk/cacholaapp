'use client'

import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Loader2, Link2, Link2Off } from 'lucide-react'
import { useUnits } from '@/hooks/use-units'
import {
  useUpdateSeller,
  useUsersAvailableForSellerLink,
  useSetSellerUserLink,
  type SellerUserLink,
} from '@/hooks/use-sellers'
import { ROLE_LABELS } from '@/lib/constants'
import type { Seller, SellerFormInput } from '@/types/seller'

interface SellerEditSheetProps {
  seller: Seller | null
  linkedUser: SellerUserLink | null
  open: boolean
  onOpenChange: (open: boolean) => void
  isSuperAdmin: boolean
  canManageLink: boolean
}

export function SellerEditSheet({
  seller,
  linkedUser,
  open,
  onOpenChange,
  isSuperAdmin,
  canManageLink,
}: SellerEditSheetProps) {
  const { data: units = [] } = useUnits()
  const updateSeller = useUpdateSeller()
  const setLink = useSetSellerUserLink()

  const [confirmUnlink, setConfirmUnlink] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>('')

  // Seletor de "vincular" só quando faz sentido: vendedora real, ativa, sem
  // usuário e quem opera pode gerenciar. Lazy — não busca usuários à toa.
  const canPickUser =
    open &&
    canManageLink &&
    !!seller &&
    !seller.is_system_account &&
    seller.status === 'active' &&
    !linkedUser
  const { data: availableUsers = [] } = useUsersAvailableForSellerLink(canPickUser)

  const [form, setForm] = useState<SellerFormInput>({
    name: '',
    email: null,
    status: 'active',
    hire_date: null,
    termination_date: null,
    primary_unit_id: null,
    notes: null,
    is_system_account: false,
  })

  useEffect(() => {
    if (seller) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        name: seller.name,
        email: seller.email,
        status: seller.status,
        hire_date: seller.hire_date,
        termination_date: seller.termination_date,
        primary_unit_id: seller.primary_unit_id,
        notes: seller.notes,
        is_system_account: seller.is_system_account,
      })
      setConfirmUnlink(false)
      setSelectedUserId('')
    }
  }, [seller])

  function handleUnlink() {
    if (!seller) return
    setLink.mutate(
      { sellerId: seller.id, userId: null },
      { onSuccess: () => setConfirmUnlink(false) },
    )
  }

  function handleLink() {
    if (!seller || !selectedUserId) return
    setLink.mutate(
      { sellerId: seller.id, userId: selectedUserId },
      { onSuccess: () => setSelectedUserId('') },
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!seller) return

    const payload: SellerFormInput = {
      ...form,
      termination_date: form.status === 'inactive' ? form.termination_date : null,
    }

    updateSeller.mutate(
      { id: seller.id, input: payload },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton
        className="w-full sm:max-w-lg flex flex-col gap-0 p-0"
      >
        <SheetHeader className="px-6 py-4 border-b border-border-default">
          <SheetTitle className="text-base font-semibold">Editar Vendedora</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Nome — read-only (vem do Ploomes) */}
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={form.name}
                disabled
                className="bg-surface-secondary cursor-not-allowed"
              />
              <p className="text-xs text-text-tertiary">Nome sincronizado pelo Ploomes — não editável.</p>
            </div>

            {/* Usuário vinculado */}
            {seller && (
              <div className="space-y-2 rounded-lg border border-border-default p-3">
                <Label className="flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-text-tertiary" />
                  Usuário vinculado
                </Label>

                {seller.is_system_account ? (
                  <p className="text-xs text-text-tertiary">
                    Contas de sistema não vinculam usuário.
                  </p>
                ) : linkedUser ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-text-primary truncate">{linkedUser.name}</div>
                      {linkedUser.email && (
                        <div className="text-xs text-text-tertiary truncate">{linkedUser.email}</div>
                      )}
                    </div>
                    {canManageLink &&
                      (confirmUnlink ? (
                        <div className="flex shrink-0 gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmUnlink(false)}
                            disabled={setLink.isPending}
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={handleUnlink}
                            disabled={setLink.isPending}
                          >
                            {setLink.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                            Confirmar
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          onClick={() => setConfirmUnlink(true)}
                        >
                          <Link2Off className="mr-1.5 h-3.5 w-3.5" />
                          Desvincular
                        </Button>
                      ))}
                  </div>
                ) : seller.status !== 'active' ? (
                  <p className="text-xs text-text-tertiary">
                    Vendedora inativa — reative para vincular um usuário.
                  </p>
                ) : !canManageLink ? (
                  <p className="text-xs text-text-tertiary">Sem usuário vinculado.</p>
                ) : (
                  <div className="space-y-2">
                    <Select
                      value={selectedUserId}
                      onValueChange={(v) => setSelectedUserId(v ?? '')}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {selectedUserId
                            ? (availableUsers.find((u) => u.id === selectedUserId)?.name ??
                              'Selecione um usuário')
                            : 'Selecione um usuário'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {availableUsers.length === 0 ? (
                          <div className="px-2 py-3 text-xs text-text-tertiary">
                            Nenhum usuário disponível para vincular.
                          </div>
                        ) : (
                          availableUsers.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                              <span className="ml-1.5 text-xs text-text-tertiary">
                                ({ROLE_LABELS[u.role] ?? u.role})
                              </span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleLink}
                      disabled={!selectedUserId || setLink.isPending}
                    >
                      {setLink.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      <Link2 className="mr-1.5 h-3.5 w-3.5" />
                      Vincular
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* E-mail */}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value || null }))}
                placeholder="vendedora@email.com"
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, status: v as 'active' | 'inactive' }))
                }
              >
                <SelectTrigger id="status" className="w-full">
                  <SelectValue>
                    {form.status === 'active' ? 'Ativa' : 'Inativa'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="inactive">Inativa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Data de contratação */}
            <div className="space-y-1.5">
              <Label htmlFor="hire_date">Data de contratação</Label>
              <Input
                id="hire_date"
                type="date"
                value={form.hire_date ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, hire_date: e.target.value || null }))}
              />
            </div>

            {/* Data de desligamento — só quando inativa */}
            {form.status === 'inactive' && (
              <div className="space-y-1.5">
                <Label htmlFor="termination_date">Data de desligamento</Label>
                <Input
                  id="termination_date"
                  type="date"
                  value={form.termination_date ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, termination_date: e.target.value || null }))
                  }
                />
              </div>
            )}

            {/* Unidade */}
            <div className="space-y-1.5">
              <Label htmlFor="unit">Unidade principal</Label>
              <Select
                value={form.primary_unit_id ?? 'none'}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, primary_unit_id: v === 'none' ? null : v }))
                }
              >
                <SelectTrigger id="unit" className="w-full">
                  <SelectValue>
                    {form.primary_unit_id
                      ? (units.find((u) => u.id === form.primary_unit_id)?.name ?? 'Nenhuma')
                      : 'Nenhuma'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="w-full">
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {units
                    .filter((u) => u.is_active)
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notas */}
            <div className="space-y-1.5">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={form.notes ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))}
                rows={3}
                placeholder="Ex: Responsável pela unidade Pinheiros…"
              />
            </div>

            {/* Conta de sistema — super_admin apenas */}
            {isSuperAdmin && (
              <div className="flex items-start gap-3 rounded-lg border border-border-default p-3">
                <Switch
                  id="is_system"
                  checked={form.is_system_account ?? false}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, is_system_account: v }))}
                  className="mt-0.5"
                />
                <div>
                  <Label htmlFor="is_system" className="cursor-pointer font-medium">
                    Conta de sistema
                  </Label>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    Contas de sistema (bots, automações) nunca aparecem em rankings de BI.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-border-default flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateSeller.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={updateSeller.isPending}>
              {updateSeller.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
