import { PageHeader } from '@/components/shared/page-header'

export default function ManutencaoConfiguracoesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações de Manutenção"
        description="Setores, categorias, itens e regras de SLA"
      />
      <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
        <p className="text-sm">Em construção — disponível no Prompt 5.</p>
      </div>
    </div>
  )
}
