'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { SyncStatusCard } from '@/components/features/ploomes/sync-status-card'
import { SyncHistoryTable } from '@/components/features/ploomes/sync-history-table'
import { FieldMappingCard } from '@/components/features/ploomes/field-mapping-card'
import { PageHeader } from '@/components/shared/page-header'

export default function PloomesIntegrationPage() {
  return (
    <div className="space-y-6">
      {/* Voltar */}
      <Link
        href="/configuracoes"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Configurações
      </Link>

      <PageHeader
        title="Integração Ploomes CRM"
        description="Sincronize as festas fechadas do Ploomes com o Cachola OS automaticamente."
      />

      {/* Status e ação principal */}
      <SyncStatusCard />

      {/* Mapeamento de campos */}
      <FieldMappingCard />

      {/* Histórico */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Histórico de Sincronizações</h2>
        <SyncHistoryTable />
      </section>
    </div>
  )
}
