'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { EventForm } from '@/components/features/events/event-form'
import { useEvent } from '@/hooks/use-events'

export default function EditarEventoPage() {
  const { id } = useParams<{ id: string }>()
  const { data: event, isLoading, isError } = useEvent(id)

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4 max-w-2xl">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
        </div>
      </div>
    )
  }

  if (isError || !event) {
    return (
      <div className="space-y-4">
        <Link href="/eventos" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar para eventos
        </Link>
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          Evento não encontrado. Verifique o link e tente novamente.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editar Evento"
        description={event.title}
      />

      {/* Aviso quando evento é do Ploomes */}
      {event.ploomes_deal_id && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
          <p>
            Este evento veio do <strong>Ploomes CRM</strong>. Alterações nos campos de data, horário, aniversariante e convidados serão <strong>sobrescritas na próxima sincronização</strong>. Edite esses dados diretamente no Ploomes.
          </p>
        </div>
      )}

      <EventForm event={event} />
    </div>
  )
}
