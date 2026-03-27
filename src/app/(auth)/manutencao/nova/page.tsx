import { PageHeader } from '@/components/shared/page-header'
import { MaintenanceForm } from '@/components/features/maintenance/maintenance-form'

export default function NovaOrdemPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Nova Ordem de Manutenção"
        description="Registre um novo serviço de manutenção"
      />
      <div className="bg-card rounded-xl border border-border p-6">
        <MaintenanceForm />
      </div>
    </div>
  )
}
