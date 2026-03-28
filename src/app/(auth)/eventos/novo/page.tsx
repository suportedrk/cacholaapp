import { PageHeader } from '@/components/shared/page-header'
import { EventForm } from '@/components/features/events/event-form'

export default function NovoEventoPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <PageHeader title="Novo Evento" description="Preencha as informações para criar um novo evento" />
      </div>

      <EventForm />
    </div>
  )
}
