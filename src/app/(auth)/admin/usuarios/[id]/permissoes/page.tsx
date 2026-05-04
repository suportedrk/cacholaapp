'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, Shield, AlertCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useUser } from '@/hooks/use-users'
import {
  useUserPermissions, useUpdatePermission,
  useRoleTemplateDiff, useApplyRoleTemplate,
} from '@/hooks/use-permissions'
import { useModules } from '@/hooks/use-rbac-catalogs'
import { UserAvatar } from '@/components/shared/user-avatar'
import { ACTION_LABELS, ROLE_LABELS } from '@/lib/constants'
import type { Module, Action } from '@/types/permissions'
import type { UserRole } from '@/types/database.types'
import { hasRole, TEMPLATE_MANAGE_ROLES } from '@/config/roles'

const ACTIONS: Action[] = ['view', 'create', 'edit', 'delete', 'export']

export default function PermissoesUsuarioPage() {
  const params = useParams()
  const id = params.id as string

  const [diffOpen, setDiffOpen] = useState(false)

  const { data: user, isLoading: userLoading } = useUser(id)
  const { data: permissions, isLoading: permsLoading } = useUserPermissions(id)
  const { data: modules, isLoading: modulesLoading, isError: modulesError } = useModules()
  const updatePerm = useUpdatePermission()

  // Diff carrega só quando o dialog abre (lazy via userId vazio quando fechado)
  const { data: diff, isLoading: diffLoading } = useRoleTemplateDiff(diffOpen ? id : '')
  const applyTemplate = useApplyRoleTemplate()

  const isLoading = userLoading || permsLoading || modulesLoading

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

  if (modulesError || !modules?.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] gap-3">
        <AlertCircle className="w-8 h-8 text-destructive" />
        <p className="text-sm text-muted-foreground">
          Erro ao carregar catálogo de módulos. Tente novamente.
        </p>
      </div>
    )
  }

  function getPermission(module: Module, action: Action): boolean {
    return permissions?.[module]?.[action] ?? false
  }

  async function handleToggle(module: Module, action: Action) {
    const current = getPermission(module, action)
    await updatePerm.mutateAsync({ userId: id, module, action, granted: !current })
  }

  async function handleApplyTemplate() {
    await applyTemplate.mutateAsync({ userId: id })
    setDiffOpen(false)
    toast.success('Template de permissões aplicado com sucesso.')
  }

  const isSuperAdmin = hasRole(user.role, TEMPLATE_MANAGE_ROLES)
  const roleLabel = ROLE_LABELS[user.role as UserRole] ?? user.role

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
        <div className="ml-auto flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDiffOpen(true)}
            disabled={isSuperAdmin}
            title={isSuperAdmin ? 'super_admin tem acesso total' : undefined}
          >
            <RefreshCw className="w-4 h-4" />
            Aplicar template do cargo
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span>Permissões individuais</span>
          </div>
        </div>
      </div>

      {/* Aviso super_admin */}
      {isSuperAdmin && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-700">
          Este usuário é <strong>super_admin</strong> e tem acesso total independente das permissões abaixo.
        </div>
      )}

      {/* Matriz de permissões */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_repeat(5,_minmax(0,_1fr))] gap-2 px-4 py-3 border-b border-border bg-muted/30">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Módulo
          </span>
          {ACTIONS.map((action) => (
            <span
              key={action}
              className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center"
            >
              {ACTION_LABELS[action]}
            </span>
          ))}
        </div>

        {/* Linhas */}
        {modules.map((module, i) => (
          <div
            key={module.code}
            className={`grid grid-cols-[1fr_repeat(5,_minmax(0,_1fr))] gap-2 px-4 py-3 items-center ${
              i % 2 === 0 ? '' : 'bg-muted/10'
            }`}
          >
            <span className="text-sm font-medium text-foreground">{module.label}</span>
            {ACTIONS.map((action) => {
              const granted = getPermission(module.code as Module, action)
              const isUpdating = updatePerm.isPending

              return (
                <div key={action} className="flex justify-center">
                  <Switch
                    checked={granted}
                    onCheckedChange={() => handleToggle(module.code as Module, action)}
                    disabled={isUpdating || isSuperAdmin}
                    aria-label={`${module.label} — ${ACTION_LABELS[action]}`}
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

      {/* Modal — Aplicar template do cargo */}
      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Aplicar template do cargo</DialogTitle>
            <DialogDescription>
              Template padrão para <strong>{roleLabel}</strong>
              {diff && !diffLoading && (
                diff.changed_count > 0
                  ? ` — ${diff.changed_count} permissão(ões) serão ajustadas`
                  : ' — permissões já alinhadas com o template'
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
              Nenhuma alteração necessária. As permissões já estão alinhadas com o template do cargo.
            </p>
          )}

          {!diffLoading && diff && diff.changed_count > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                  <tr className="border-b border-border">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Módulo</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Ação</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">Atual</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">Template</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.diffs.filter((d) => d.has_diff).map((d) => (
                    <tr key={`${d.module}:${d.action}`} className="border-b border-border/50 last:border-0">
                      <td className="px-3 py-2 font-medium text-foreground">{d.module_label}</td>
                      <td className="px-3 py-2 text-muted-foreground">{ACTION_LABELS[d.action]}</td>
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
            <Button variant="outline" onClick={() => setDiffOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleApplyTemplate}
              disabled={applyTemplate.isPending || diffLoading || (diff?.changed_count === 0)}
            >
              {applyTemplate.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {diff && diff.changed_count > 0
                ? `Aplicar ${diff.changed_count} alterações`
                : 'Nenhuma alteração'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
