'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, AlertCircle, Users, CheckCircle2, XCircle, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import {
  useRoles, useModules, useRolePermissions,
  useUpdateRolePermission, useApplyTemplateToAllUsers,
  type ApplyToAllResult,
} from '@/hooks/use-rbac-catalogs'
import { ACTION_LABELS, ROLE_LABELS } from '@/lib/constants'
import type { Action } from '@/types/permissions'

const ACTIONS: Action[] = ['view', 'create', 'edit', 'delete', 'export']

function ApplyResultCard({ result }: { result: ApplyToAllResult }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-2xl font-semibold text-foreground">{result.total_users}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Total de usuários</p>
        </div>
        <div className="rounded-lg bg-green-50 p-3">
          <p className="text-2xl font-semibold text-green-700">{result.total_succeeded}</p>
          <p className="text-xs text-green-600 mt-0.5">Com sucesso</p>
        </div>
        <div className={`rounded-lg p-3 ${result.total_failed > 0 ? 'bg-red-50' : 'bg-muted/30'}`}>
          <p className={`text-2xl font-semibold ${result.total_failed > 0 ? 'text-red-700' : 'text-muted-foreground'}`}>
            {result.total_failed}
          </p>
          <p className={`text-xs mt-0.5 ${result.total_failed > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
            Falhas
          </p>
        </div>
      </div>

      {result.total_failed > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 divide-y divide-red-100 max-h-48 overflow-y-auto">
          {result.failed.map((f) => (
            <div key={f.user_id} className="px-3 py-2 flex items-start gap-2">
              <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-red-800 truncate">{f.email}</p>
                <p className="text-xs text-red-600 truncate">{f.error_message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {result.total_succeeded > 0 && result.total_failed === 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
          <p className="text-sm text-green-700">Template aplicado com sucesso a todos os usuários.</p>
        </div>
      )}
    </div>
  )
}

export default function CargoDetailPage() {
  const router = useRouter()
  const { code } = useParams<{ code: string }>()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [applyResult, setApplyResult] = useState<ApplyToAllResult | null>(null)

  const { data: roles } = useRoles()
  const { data: modules, isLoading: modulesLoading, isError: modulesError } = useModules()
  const { data: perms, isLoading: permsLoading } = useRolePermissions(code)
  const updatePerm = useUpdateRolePermission()
  const applyToAll = useApplyTemplateToAllUsers()

  const role = roles?.find((r) => r.code === code)
  const isLoading = modulesLoading || permsLoading

  function getGranted(moduleCode: string, action: string): boolean {
    return perms?.find((p) => p.module_code === moduleCode && p.action === action)?.granted ?? false
  }

  function handleToggle(moduleCode: string, action: string) {
    const current = getGranted(moduleCode, action)
    updatePerm.mutate({ role_code: code, module_code: moduleCode, action, granted: !current })
  }

  async function handleApplyToAll() {
    const result = await applyToAll.mutateAsync(code)
    setApplyResult(result)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (modulesError || !modules?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <AlertCircle className="w-10 h-10 text-status-error-text" />
        <p className="font-medium text-foreground">Erro ao carregar módulos</p>
      </div>
    )
  }

  const roleLabel = ROLE_LABELS[code] ?? role?.label ?? code

  return (
    <div className="max-w-4xl space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/admin/cargos')}
          className="mt-0.5 flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-brand-600" />
            {roleLabel}
          </h1>
          {role?.description && (
            <p className="mt-1 text-sm text-muted-foreground">{role.description}</p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => { setApplyResult(null); setConfirmOpen(true) }}
          className="flex-shrink-0"
          disabled={applyToAll.isPending}
        >
          <Users className="w-4 h-4" />
          Aplicar a todos
        </Button>
      </div>

      {/* Matrix */}
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
              const granted = getGranted(module.code, action)
              return (
                <div key={action} className="flex justify-center">
                  <Switch
                    checked={granted}
                    onCheckedChange={() => handleToggle(module.code, action)}
                    disabled={updatePerm.isPending}
                    aria-label={`${module.label} — ${ACTION_LABELS[action]}`}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Alterações no template não afetam usuários existentes. Use &ldquo;Aplicar a todos&rdquo; para propagar.
      </p>

      {/* Dialog — Aplicar a todos */}
      <Dialog open={confirmOpen} onOpenChange={(open) => { if (!applyToAll.isPending) setConfirmOpen(open) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Aplicar template a todos os usuários</DialogTitle>
            <DialogDescription>
              {applyResult
                ? 'Resultado da operação:'
                : `As permissões do template "${roleLabel}" serão aplicadas a todos os usuários com esse cargo. Permissões individuais serão sobrescritas.`
              }
            </DialogDescription>
          </DialogHeader>

          {applyResult ? (
            <ApplyResultCard result={applyResult} />
          ) : null}

          <DialogFooter>
            {applyResult ? (
              <Button onClick={() => setConfirmOpen(false)}>Fechar</Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setConfirmOpen(false)}
                  disabled={applyToAll.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleApplyToAll}
                  disabled={applyToAll.isPending}
                >
                  {applyToAll.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Confirmar e aplicar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
