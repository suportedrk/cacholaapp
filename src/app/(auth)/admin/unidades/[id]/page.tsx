'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Loader2, Users, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { useUnit, useUpdateUnit, useUnitUsers, useAddUserToUnit, useRemoveUserFromUnit, useUpdateUserUnitRole } from '@/hooks/use-units'
import { useUsers } from '@/hooks/use-users'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ROUTES, ROLE_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types/database.types'

const AVAILABLE_ROLES: UserRole[] = ['super_admin', 'diretor', 'gerente', 'vendedora', 'decoracao', 'manutencao', 'financeiro', 'rh', 'freelancer', 'entregador']

function toSlug(name: string) {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
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
  const { mutate: updateRole } = useUpdateUserUnitRole()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [slugEdited, setSlugEdited] = useState(false)

  // Add user state
  const [addUserId, setAddUserId] = useState('')
  const [addRole, setAddRole] = useState<UserRole>('gerente')

  useEffect(() => {
    if (unit) {
      setName(unit.name)
      setSlug(unit.slug)
      setAddress(unit.address ?? '')
      setPhone(unit.phone ?? '')
      setIsActive(unit.is_active)
    }
  }, [unit])

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

  // Users already in this unit
  const unitUserIds = new Set(unitUsers?.map((uu) => uu.user_id) ?? [])
  const availableUsers = allUsers?.filter((u) => !unitUserIds.has(u.id)) ?? []

  if (isLoading) {
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
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">{unit.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Editar dados da unidade</p>
        </div>
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
            <select
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
              className={cn(
                'flex-1 min-w-[160px] h-10 rounded-md border border-input bg-background px-3 py-2 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
            >
              <option value="">Selecionar usuário...</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
            <select
              value={addRole}
              onChange={(e) => setAddRole(e.target.value as UserRole)}
              className={cn(
                'h-10 rounded-md border border-input bg-background px-3 py-2 text-sm',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
              )}
            >
              {AVAILABLE_ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
              ))}
            </select>
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
                  <select
                    value={uu.role}
                    onChange={(e) => updateRole({ id: uu.id, userId: uu.user_id, role: e.target.value as UserRole })}
                    className={cn(
                      'h-8 rounded-md border border-input bg-background px-2 py-1 text-xs',
                      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
                    )}
                  >
                    {AVAILABLE_ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                    ))}
                  </select>
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
    </div>
  )
}
