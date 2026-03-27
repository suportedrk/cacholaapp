'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
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
      <div className="flex items-center gap-3">
        <Link
          href={`/eventos/${id}`}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Voltar para o evento"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <PageHeader
          title="Editar Evento"
          description={event.title}
        />
      </div>

      <EventForm event={event} />
    </div>
  )
}
