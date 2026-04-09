'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { MaintenanceKPIs } from '@/components/features/maintenance/maintenance-kpis'
import { MaintenanceCharts } from '@/components/features/maintenance/maintenance-charts'
import { MaintenanceTabs } from '@/components/features/maintenance/maintenance-tabs'

export default function ChamadosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Chamados"
        description="Gerencie ordens de serviço, manutenções preventivas e emergenciais"
        actions={
          <Link href="/manutencao/nova">
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Nova Ordem
            </Button>
          </Link>
        }
      />

      {/* ── KPIs + Charts ────────────────────────────────────── */}
      <MaintenanceKPIs />
      <MaintenanceCharts />

      {/* ── Tabs: Ordens / Fornecedores / Custos / Histórico ── */}
      <MaintenanceTabs />
    </div>
  )
}
