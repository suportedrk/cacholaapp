'use client'

import { useMemo, useState } from 'react'
import { ShieldOff } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { AuditFilters } from '@/components/features/audit/audit-filters'
import { AuditLogTable } from '@/components/features/audit/audit-log-table'
import { useAuditLogs } from '@/hooks/use-audit-logs'
import { useAuth } from '@/hooks/use-auth'
import { useUserPermissions } from '@/hooks/use-permissions'
import type { AuditLogFilters, AuditLogWithUser } from '@/types/database.types'

export default function LogsPage() {
  const { profile, loading: authLoading } = useAuth()
  const { data: permMap } = useUserPermissions(profile?.id)
  const [filters, setFilters] = useState<AuditLogFilters>({})

  const canView = permMap?.audit_logs?.view === true

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useAuditLogs(filters)

  // Achata todas as páginas em uma lista única
  const logs = useMemo<AuditLogWithUser[]>(
    () => data?.pages.flatMap((p) => p) ?? [],
    [data]
  )

  // ── Acesso negado ────────────────────────────────────────
  if (!authLoading && !canView) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <ShieldOff className="size-12 text-muted-foreground" />
        <div>
          <p className="font-semibold text-foreground">Acesso restrito</p>
          <p className="text-sm text-muted-foreground mt-1">
            Você não tem permissão para visualizar os logs de auditoria.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logs de Auditoria"
        description="Histórico completo de ações realizadas no sistema"
      />

      <AuditFilters filters={filters} onChange={setFilters} />

      <AuditLogTable
        logs={logs}
        isLoading={isLoading || authLoading}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage ?? false}
        onLoadMore={fetchNextPage}
      />
    </div>
  )
}
