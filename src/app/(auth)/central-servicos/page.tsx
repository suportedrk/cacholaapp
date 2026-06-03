import Link from 'next/link'
import { Link2, Contact, Megaphone, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { ROUTES } from '@/lib/constants'
import { cn } from '@/lib/utils'

export const metadata = {
  title: 'Central de Serviços',
}

/**
 * Página inicial (hub) do módulo Central de Serviços.
 *
 * Bloco B: a feature "Links úteis" está disponível. "Agenda de Contatos" e
 * "Mural de Avisos" chegam nos próximos blocos da Fase 1.
 */
export default function CentralServicosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Serviços"
        description="Área de uso geral da equipe — links úteis, contatos e avisos da empresa."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Links úteis — ativo */}
        <Link
          href={ROUTES.centralServicosLinks}
          className={cn(
            'group flex items-start gap-3 rounded-xl border border-border bg-card p-5',
            'transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Link2 className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">Links úteis</h2>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Atalhos para os sistemas e portais da empresa.
            </p>
          </div>
        </Link>

        {/* Agenda de Contatos — ativo */}
        <Link
          href={ROUTES.centralServicosContatos}
          className={cn(
            'group flex items-start gap-3 rounded-xl border border-border bg-card p-5',
            'transition-shadow hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Contact className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">Agenda de Contatos</h2>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Contatos das pessoas e setores da empresa.
            </p>
          </div>
        </Link>

        {/* Mural de Avisos — em breve */}
        <div
          aria-disabled="true"
          className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-card p-5 opacity-60"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary">
            <Megaphone className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">Mural de Avisos</h2>
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Em breve
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Comunicados e avisos internos.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
