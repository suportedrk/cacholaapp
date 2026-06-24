import { PageHeader } from '@/components/shared/page-header'
import { CentralServicosDashboard } from './_components/central-servicos-dashboard'

export const metadata = {
  title: 'Central de Serviços',
}

/**
 * Página inicial (hub) do módulo Central de Serviços.
 * Fase 2 (Bloco E.3): atalhos com contadores + meus avisos pendentes de
 * confirmação + acompanhamento de confirmações para a gestão.
 */
export default function CentralServicosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Serviços"
        description="Área de uso geral da equipe — links úteis, contatos e avisos da empresa."
      />
      <CentralServicosDashboard />
    </div>
  )
}
