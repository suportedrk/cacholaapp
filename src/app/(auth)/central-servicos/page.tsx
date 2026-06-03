import { LifeBuoy, Link2, Contact, Megaphone } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'

export const metadata = {
  title: 'Central de Serviços',
}

/**
 * Página inicial do módulo Central de Serviços (Bloco A — fundação).
 *
 * Por enquanto exibe apenas o cabeçalho do módulo e um espaço reservado.
 * As funcionalidades (Links úteis, Agenda de Contatos e Mural de Avisos)
 * entram nos próximos blocos da Fase 1.
 */
export default function CentralServicosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Serviços"
        description="Área de uso geral da equipe — links úteis, contatos e avisos da empresa."
      />

      {/* Espaço reservado: os blocos da Fase 1 entram aqui. */}
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <LifeBuoy className="h-6 w-6 text-primary" />
        </div>
        <h2 className="mt-4 text-base font-semibold text-foreground">
          Em construção
        </h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          As funcionalidades da Central de Serviços chegam em breve. Por enquanto, este é
          o espaço reservado do módulo.
        </p>

        <ul className="mt-6 flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:gap-6">
          <li className="flex items-center justify-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            Links úteis
          </li>
          <li className="flex items-center justify-center gap-2">
            <Contact className="h-4 w-4 text-muted-foreground" />
            Agenda de Contatos
          </li>
          <li className="flex items-center justify-center gap-2">
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            Mural de Avisos
          </li>
        </ul>
      </div>
    </div>
  )
}
