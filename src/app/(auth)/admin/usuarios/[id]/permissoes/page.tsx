'use client'

import { useParams } from 'next/navigation'

import { Loader2, Shield } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useUser } from '@/hooks/use-users'
import { useUserPermissions, useUpdatePermission } from '@/hooks/use-permissions'
import { UserAvatar } from '@/components/shared/user-avatar'
import { MODULE_LABELS, ACTION_LABELS } from '@/lib/constants'
import type { Module, Action } from '@/types/permissions'

const MODULES: Module[] = [
  'events', 'maintenance', 'checklists', 'users',
  'reports', 'audit_logs', 'notifications', 'settings'
]
const ACTIONS: Action[] = ['view', 'create', 'edit', 'delete', 'export']

export default function PermissoesUsuarioPage() {
  const params = useParams()
  const id = params.id as string

  const { data: user, isLoading: userLoading } = useUser(id)
  const { data: permissions, isLoading: permsLoading } = useUserPermissions(id)
  const updatePerm = useUpdatePermission()

  const isLoading = userLoading || permsLoading

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Carregando permissões...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Usuário não encontrado.</p>
      </div>
    )
  }

  function getPermission(module: Module, action: Action): boolean {
    return permissions?.[module]?.[action] ?? false
  }

  async function handleToggle(module: Module, action: Action) {
    const current = getPermission(module, action)
    await updatePerm.mutateAsync({
      userId: id,
      module,
      action,
      granted: !current,
    })
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Permissões</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Controle granular de acesso</p>
      </div>

      {/* Usuário */}
      <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
        <UserAvatar name={user.name} avatarUrl={user.avatar_url} size="md" />
        <div>
          <p className="font-medium text-foreground">{user.name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <Shield className="w-4 h-4" />
          <span>Permissões individuais</span>
        </div>
      </div>

      {/* Aviso super_admin */}
      {user.role === 'super_admin' && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
          Este usuário é <strong>super_admin</strong> e tem acesso total independente das permissões abaixo.
        </div>
      )}

      {/* Matriz de permissões */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_repeat(5,_minmax(0,_1fr))] gap-2 px-4 py-3 border-b border-border bg-muted/30">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Módulo</span>
          {ACTIONS.map((action) => (
            <span key={action} className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center">
              {ACTION_LABELS[action]}
            </span>
          ))}
        </div>

        {/* Linhas */}
        {MODULES.map((module, i) => (
          <div
            key={module}
            className={`grid grid-cols-[1fr_repeat(5,_minmax(0,_1fr))] gap-2 px-4 py-3 items-center ${
              i % 2 === 0 ? '' : 'bg-muted/10'
            }`}
          >
            <span className="text-sm font-medium text-foreground">{MODULE_LABELS[module]}</span>
            {ACTIONS.map((action) => {
              const granted = getPermission(module, action)
              const isUpdating = updatePerm.isPending

              return (
                <div key={action} className="flex justify-center">
                  <Switch
                    checked={granted}
                    onCheckedChange={() => handleToggle(module, action)}
                    disabled={isUpdating || user.role === 'super_admin'}
                    aria-label={`${MODULE_LABELS[module]} — ${ACTION_LABELS[action]}`}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Alterações são salvas imediatamente. As permissões entram em vigor no próximo acesso do usuário.
      </p>
    </div>
  )
}
