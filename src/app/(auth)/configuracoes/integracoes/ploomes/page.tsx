'use client'

import { MapPin } from 'lucide-react'
import Link from 'next/link'
import { SyncStatusCard } from '@/components/features/ploomes/sync-status-card'
import { SyncHistoryTable } from '@/components/features/ploomes/sync-history-table'
import { PageHeader } from '@/components/shared/page-header'

export default function PloomesIntegrationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Integração Ploomes CRM"
        description="Sincronize as festas fechadas do Ploomes com o Cachola OS automaticamente."
        actions={
          <Link
            href="/configuracoes/integracoes/ploomes/mapeamento"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
          >
            <MapPin className="h-3.5 w-3.5" />
            Ver Mapeamento de Campos
          </Link>
        }
      />

      {/* Status e ação principal */}
      <SyncStatusCard />

      {/* Histórico */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Histórico de Sincronizações</h2>
        <SyncHistoryTable />
      </section>
    </div>
  )
}
