'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Loader2, Save, UserX, UserCheck, Building2, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/shared/status-badge'
import { UserAvatar } from '@/components/shared/user-avatar'
import { useUser, useUpdateUser, useDeactivateUser, useReactivateUser } from '@/hooks/use-users'
import { useUserUnits, useRemoveUserFromUnit, useUpdateUserUnitRole } from '@/hooks/use-units'
import { useAuth } from '@/hooks/use-auth'
import { useStartImpersonate } from '@/hooks/use-impersonate'
import { ROLE_LABELS, ROUTES } from '@/lib/constants'
import type { UserRole } from '@/types/database.types'

export default function EditarUsuarioPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const { data: user, isLoading } = useUser(id)
  const updateUser = useUpdateUser()
  const deactivateUser = useDeactivateUser()
  const reactivateUser = useReactivateUser()
  const { data: userUnits } = useUserUnits(id)
  const { mutate: removeFromUnit } = useRemoveUserFromUnit()
  const { mutate: updateRole } = useUpdateUserUnitRole()

  // "Ver como" — apenas para super_admin real
  const { realProfile } = useAuth()
  const startImpersonate = useStartImpersonate()
  const canViewAs =
    realProfile?.role === 'super_admin' &&
    !!user &&
    user.id !== realProfile.id &&
    (user.role as UserRole) !== 'super_admin'

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (user) {
      setName(user.name)
      setPhone(user.phone ?? '')
    }
  }, [user])
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return

    await updateUser.mutateAsync({
      id: user.id,
      data: { name: name.trim(), phone: phone.trim() || null },
    })
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <p className="text-sm font-medium text-foreground">Usuário não encontrado</p>
        <Button variant="ghost" className="mt-3" onClick={() => router.push(ROUTES.users)}>
          Voltar para usuários
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">Editar Usuário</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Dados pessoais e status</p>
        </div>
        {canViewAs && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={startImpersonate.isPending}
            onClick={async () => {
              await startImpersonate.mutateAsync(user!.id)
              router.push(ROUTES.dashboard)
            }}
            className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
          >
            {startImpersonate.isPending
              ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              : <Eye className="w-4 h-4 mr-2" />
            }
            Ver como {user!.name.split(' ')[0]}
          </Button>
        )}
      </div>

      {/* Card principal */}
      <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
        {/* Avatar + role + status */}
        <div className="flex items-center gap-4">
          <UserAvatar name={user.name} avatarUrl={user.avatar_url} size="lg" />
          <div>
            <p className="font-medium text-foreground">{user.name}</p>
            <p className="text-sm text-muted-foreground">{ROLE_LABELS[user.role] ?? user.role}</p>
            <div className="mt-1">
              <StatusBadge active={user.is_active} />
            </div>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={user.email} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado aqui.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Nome completo *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do usuário"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone / WhatsApp</Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="submit" disabled={updateUser.isPending}>
              {updateUser.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Salvando...</>
              ) : (
                <><Save className="w-4 h-4 mr-2" />Salvar alterações</>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() =>
                user.is_active
                  ? deactivateUser.mutate(user.id)
                  : reactivateUser.mutate(user.id)
              }
              disabled={deactivateUser.isPending || reactivateUser.isPending}
              className={user.is_active ? 'text-destructive border-destructive/30 hover:bg-destructive/10' : ''}
            >
              {user.is_active ? (
                <><UserX className="w-4 h-4 mr-2" />Desativar usuário</>
              ) : (
                <><UserCheck className="w-4 h-4 mr-2" />Reativar usuário</>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push(`${ROUTES.users}/${user.id}/permissoes`)}
            >
              Gerenciar permissões →
            </Button>
          </div>
        </form>
      </div>
      {/* Seção de Unidades */}
      <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Unidades Vinculadas
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.push(ROUTES.units)}
          >
            Gerenciar unidades →
          </Button>
        </div>

        {userUnits && userUnits.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma unidade vinculada.</p>
        )}

        {userUnits && userUnits.length > 0 && (
          <div className="space-y-2">
            {userUnits.map((uu) => {
              const unit = uu.unit as { id: string; name: string; slug: string; is_active: boolean } | undefined
              return (
                <div key={uu.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background">
                  <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{unit?.name ?? 'Unidade'}</p>
                    <p className="text-xs text-muted-foreground font-mono">{unit?.slug}</p>
                  </div>
                  {uu.is_default && (
                    <span className="text-xs text-primary font-medium shrink-0">Padrão</span>
                  )}
                  <Select
                    value={uu.role}
                    onValueChange={(v) => v && updateRole({ id: uu.id, userId: uu.user_id, role: v as UserRole })}
                  >
                    <SelectTrigger size="sm" className="min-w-[120px]">
                      <span data-slot="select-value" className="flex flex-1 text-left text-xs">
                        {ROLE_LABELS[uu.role as UserRole] ?? uu.role}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).map(([r, label]) => (
                        <SelectItem key={r} value={r}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => removeFromUnit({ id: uu.id, userId: uu.user_id, wasDefault: uu.is_default })}
                  >
                    Remover
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
