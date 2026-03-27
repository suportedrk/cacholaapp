import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/shared/page-header'
import { EventForm } from '@/components/features/events/event-form'

export default function NovoEventoPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/eventos"
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Voltar para eventos"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <PageHeader title="Novo Evento" description="Preencha as informações para criar um novo evento" />
      </div>

      <EventForm />
    </div>
  )
}
