import { PageHeader } from '@/components/shared/page-header'
import { EquipmentForm } from '@/components/features/equipment/equipment-form'

export default function NovoEquipamentoPage() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <PageHeader
        title="Novo Equipamento"
        description="Cadastre um ativo ou equipamento do buffet"
      />
      <div className="rounded-xl border bg-card p-6">
        <EquipmentForm />
      </div>
    </div>
  )
}
