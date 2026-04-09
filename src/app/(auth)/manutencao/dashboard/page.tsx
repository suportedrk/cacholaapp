import { PageHeader } from '@/components/shared/page-header'

export default function ManutencaoDashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard de Manutenção"
        description="Visão geral de indicadores e tendências do módulo de manutenção"
      />
      <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
        <p className="text-sm">Em construção — disponível no Prompt 7.</p>
      </div>
    </div>
  )
}
