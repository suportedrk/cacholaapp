'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Loader2, Users, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  useUnit, useUpdateUnit, useUnitUsers, useAddUserToUnit,
  useRemoveUserFromUnit, useChangeUserRole,
} from '@/hooks/use-units'
import { useUsers } from '@/hooks/use-users'
import { useRoleTemplateDiff } from '@/hooks/use-permissions'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ROUTES, ROLE_LABELS, ACTION_LABELS } from '@/lib/constants'
import { useRoles } from '@/hooks/use-rbac-catalogs'
import type { UserRole } from '@/types/database.types'
import type { Action } from '@/types/permissions'

function toSlug(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

interface PendingRoleChange {
  userUnitId: string
  userId: string
  userName: string
  currentRole: UserRole
  newRole: UserRole
}

export default function EditarUnidadePage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const { data: unit, isLoading } = useUnit(id)
  const { data: unitUsers, isLoading: loadingUsers } = useUnitUsers(id)
  const { data: allUsers } = useUsers({ isActive: true })
  const { mutate: updateUnit, isPending: saving } = useUpdateUnit()
  const { mutate: addUser, isPending: addingUser } = useAddUserToUnit()
  const { mutate: removeUser } = useRemoveUserFromUnit()
  const changeRole = useChangeUserRole()
  const { data: roles, isLoading: rolesLoading } = useRoles()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [slugEdited, setSlugEdited] = useState(false)

  // Add user state
  const [addUserId, setAddUserId] = useState('')
  const [addRole, setAddRole] = useState<UserRole>('gerente')

  // Pending role change (Phase 8 modal)
  const [pending, setPending] = useState<PendingRoleChange | null>(null)

  // Diff para o cargo pendente (carrega apenas quando o modal está aberto)
  const { data: diff, isLoading: diffLoading } = useRoleTemplateDiff(
    pending ? pending.userId : '',
    pending?.newRole,
  )

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (unit) {
      setName(unit.name)
      setSlug(unit.slug)
      setAddress(unit.address ?? '')
      setPhone(unit.phone ?? '')
      setIsActive(unit.is_active)
    }
  }, [unit])
  /* eslint-enable react-hooks/set-state-in-effect */

  function handleNameChange(v: string) {
    setName(v)
    if (!slugEdited) setSlug(toSlug(v))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    updateUnit(
      { id, data: { name: name.trim(), slug, address: address.trim() || null, phone: phone.trim() || null, is_active: isActive } },
      { onSuccess: () => router.push(ROUTES.units) }
    )
  }

  function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    if (!addUserId) return
    addUser(
      { userId: addUserId, unitId: id, role: addRole },
      { onSuccess: () => setAddUserId('') }
    )
  }

  function handleRoleSelect(uu: { id: string; user_id: string; role: string }, newRole: string) {
    if (newRole === uu.role) return
    const userName = unitUsers?.find((u) => u.user_id === uu.user_id)?.user?.name ?? 'usuário'
    setPending({
      userUnitId: uu.id,
      userId: uu.user_id,
      userName,
      currentRole: uu.role as UserRole,
      newRole: newRole as UserRole,
    })
  }

  async function handleConfirmRoleChange() {
    if (!pending) return
    await changeRole.mutateAsync({
      userId: pending.userId,
      userUnitId: pending.userUnitId,
      role: pending.newRole,
    })
    setPending(null)
  }

  // Users already in this unit
  const unitUserIds = new Set(unitUsers?.map((uu) => uu.user_id) ?? [])
  const availableUsers = allUsers?.filter((u) => !unitUserIds.has(u.id)) ?? []

  if (isLoading || rolesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!unit) {
    return (
      <div className="text-center py-20 text-muted-foreground">Unidade não encontrada.</div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">{unit.name}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Editar dados da unidade</p>
      </div>

      {/* Formulário de dados */}
      <form onSubmit={handleSubmit} className="space-y-5 bg-card rounded-xl border border-border p-6">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Dados da Unidade
        </h2>

        <div className="space-y-2">
          <Label htmlFor="name">Nome *</Label>
          <Input id="name" value={name} onChange={(e) => handleNameChange(e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug">Slug *</Label>
          <Input
            id="slug"
            value={slug}
            onChange={(e) => { setSlugEdited(true); setSlug(toSlug(e.target.value)) }}
            className="font-mono text-sm"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Endereço</Label>
          <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        <div className="flex items-center justify-between py-2 border-t border-border">
          <div>
            <p className="font-medium text-sm">Unidade ativa</p>
            <p className="text-xs text-muted-foreground">Unidades inativas não aparecem para os usuários</p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1">Cancelar</Button>
          <Button type="submit" disabled={saving} className="flex-1">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar Alterações
          </Button>
        </div>
      </form>

      {/* Usuários vinculados */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Users className="w-4 h-4" />
          Usuários desta Unidade
          {unitUsers && (
            <Badge variant="secondary" className="ml-auto">{unitUsers.length}</Badge>
          )}
        </h2>

        {/* Adicionar usuário */}
        {availableUsers.length > 0 && (
          <form onSubmit={handleAddUser} className="flex gap-2 flex-wrap">
            <Select
              value={addUserId || null}
              onValueChange={(v) => setAddUserId(v ?? '')}
            >
              <SelectTrigger className="flex-1 min-w-[160px]">
                {addUserId
                  ? <span data-slot="select-value" className="flex flex-1 text-left">{availableUsers.find((u) => u.id === addUserId)?.name ?? 'Usuário'}</span>
                  : <SelectValue placeholder="Selecionar usuário..." />}
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={addRole}
              onValueChange={(v) => v && setAddRole(v as UserRole)}
            >
              <SelectTrigger className="min-w-[140px]">
                <span data-slot="select-value" className="flex flex-1 text-left">
                  {ROLE_LABELS[addRole] ?? addRole}
                </span>
              </SelectTrigger>
              <SelectContent>
                {(roles ?? []).map((r) => (
                  <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" disabled={!addUserId || addingUser} size="sm">
              {addingUser ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Vincular'}
            </Button>
          </form>
        )}

        {/* Lista de usuários */}
        {loadingUsers && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}

        {!loadingUsers && unitUsers?.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum usuário vinculado.</p>
        )}

        {unitUsers && unitUsers.length > 0 && (
          <div className="space-y-2">
            {unitUsers.map((uu) => {
              const user = uu.user
              return (
                <div key={uu.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{user?.name ?? 'Usuário'}</p>
                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  </div>
                  <Select
                    value={uu.role}
                    onValueChange={(v) => v && handleRoleSelect(uu, v)}
                  >
                    <SelectTrigger size="sm" className="min-w-[120px]">
                      <span data-slot="select-value" className="flex flex-1 text-left text-xs">
                        {ROLE_LABELS[uu.role as UserRole] ?? uu.role}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {(roles ?? []).map((r) => (
                        <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ConfirmDialog
                    title="Remover usuário"
                    description={`Remover ${user?.name ?? 'este usuário'} desta unidade?`}
                    destructive
                    onConfirm={() => removeUser({ id: uu.id, userId: uu.user_id })}
                    trigger={
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0">
                        Remover
                      </Button>
                    }
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal — Mudar cargo */}
      <Dialog open={!!pending} onOpenChange={(open) => { if (!open) setPending(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Mudar cargo</DialogTitle>
            <DialogDescription>
              {pending && (
                <>
                  Cargo de <strong>{pending.userName}</strong>:{' '}
                  <strong>{ROLE_LABELS[pending.currentRole] ?? pending.currentRole}</strong>
                  {' '}→{' '}
                  <strong>{ROLE_LABELS[pending.newRole] ?? pending.newRole}</strong>
                  {diff && !diffLoading && (
                    diff.changed_count > 0
                      ? `. ${diff.changed_count} permissão(ões) serão ajustadas.`
                      : '. As permissões já estão alinhadas com o novo cargo.'
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {diffLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!diffLoading && diff && diff.changed_count === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma alteração nas permissões necessária para este cargo.
            </p>
          )}

          {!diffLoading && diff && diff.changed_count > 0 && (
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Módulo</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Ação</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">Atual</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">Novo cargo</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.diffs.filter((d) => d.has_diff).map((d) => (
                    <tr key={`${d.module}:${d.action}`} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 font-medium text-foreground">{d.module_label}</td>
                      <td className="px-3 py-2 text-muted-foreground">{ACTION_LABELS[d.action as Action]}</td>
                      <td className="px-3 py-2 text-center">
                        {d.current === null ? (
                          <span className="text-muted-foreground text-xs">sem reg.</span>
                        ) : d.current ? (
                          <span className="text-green-600 font-semibold">✓</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {d.template ? (
                          <span className="text-green-600 font-semibold">✓</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmRoleChange}
              disabled={changeRole.isPending || diffLoading}
            >
              {changeRole.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Confirmar mudança de cargo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
