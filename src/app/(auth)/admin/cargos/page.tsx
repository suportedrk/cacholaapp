'use client'

import { useRouter } from 'next/navigation'
import { Shield, ChevronRight, Loader2, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useRoles, useRolePermissions } from '@/hooks/use-rbac-catalogs'
import { ROLE_LABELS } from '@/lib/constants'

function RoleCard({ code, label }: { code: string; label: string }) {
  const router = useRouter()
  const { data: perms, isLoading } = useRolePermissions(code)

  const granted = perms?.filter((p) => p.granted).length ?? 0
  const total = perms?.length ?? 0

  return (
    <button
      onClick={() => router.push(`/admin/cargos/${code}`)}
      className="w-full text-left rounded-xl border border-border-default bg-card p-5 card-interactive flex items-center justify-between gap-4"
    >
      <div className="flex items-center gap-4 min-w-0">
        <div className="icon-brand flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center">
          <Shield className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground truncate">
            {ROLE_LABELS[code] ?? label}
          </p>
          {isLoading ? (
            <p className="text-xs text-muted-foreground mt-0.5">Carregando...</p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">
              {granted} de {total} permissões ativas
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {!isLoading && total > 0 && (
          <Badge variant="secondary" className="tabular-nums">
            {granted}/{total}
          </Badge>
        )}
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </button>
  )
}

export default function CargosPage() {
  const { data: roles, isLoading, isError } = useRoles()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError || !roles) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <AlertCircle className="w-10 h-10 text-status-error-text" />
        <p className="font-medium text-foreground">Erro ao carregar cargos</p>
        <p className="text-sm text-muted-foreground">Tente recarregar a página.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Templates de Cargo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie as permissões padrão de cada cargo. Alterações afetam novos usuários ao serem vinculados.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <RoleCard key={role.code} code={role.code} label={role.label} />
        ))}
      </div>
    </div>
  )
}
