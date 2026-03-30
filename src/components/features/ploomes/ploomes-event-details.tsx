import { Lock, ExternalLink, User, Calendar, Clock, Users, Palette } from 'lucide-react'
import { PloomeBadge } from './ploomes-badge'

type Props = {
  event: {
    ploomes_deal_id?: string | null
    ploomes_url?: string | null
    birthday_person?: string | null
    birthday_age?: number | null
    guest_count?: number | null
    date?: string | null
    start_time?: string | null
    end_time?: string | null
    title?: string | null
  }
  theme?: string | null
}

type Field = {
  icon: React.ReactNode
  label: string
  value: string | number | null | undefined
}

export function PloomesEventDetails({ event, theme }: Props) {
  if (!event.ploomes_deal_id) return null

  const fields: Field[] = [
    {
      icon: <Calendar className="h-3.5 w-3.5" />,
      label: 'Data da Festa',
      value: event.date
        ? new Date(event.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
        : null,
    },
    {
      icon: <Clock className="h-3.5 w-3.5" />,
      label: 'Horário',
      value: event.start_time && event.end_time
        ? `${event.start_time.substring(0, 5)} – ${event.end_time.substring(0, 5)}`
        : null,
    },
    {
      icon: <User className="h-3.5 w-3.5" />,
      label: 'Aniversariante',
      value: event.birthday_person
        ? `${event.birthday_person}${event.birthday_age ? ` (${event.birthday_age} anos)` : ''}`
        : null,
    },
    {
      icon: <Users className="h-3.5 w-3.5" />,
      label: 'Convidados',
      value: event.guest_count ? `${event.guest_count} pessoas` : null,
    },
    {
      icon: <Palette className="h-3.5 w-3.5" />,
      label: 'Tema',
      value: theme ?? null,
    },
  ].filter((f) => f.value != null && f.value !== '')

  return (
    <section className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Lock className="h-3.5 w-3.5 text-blue-400" />
          <span className="text-xs font-semibold text-blue-700">Dados do Ploomes CRM</span>
          <PloomeBadge size="xs" />
        </div>
        {event.ploomes_url && (
          <a
            href={event.ploomes_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
          >
            Ver no Ploomes
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      <p className="text-[11px] text-blue-600/80">
        Estes campos são gerenciados pelo Ploomes CRM e são somente leitura no Cachola OS.
      </p>

      {/* Campos */}
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {fields.map(({ icon, label, value }) => (
          <div key={label} className="flex items-start gap-2">
            <span className="mt-0.5 text-blue-400 shrink-0">{icon}</span>
            <div>
              <dt className="text-[10px] font-medium uppercase tracking-wide text-blue-500">{label}</dt>
              <dd className="text-sm text-foreground">{value}</dd>
            </div>
          </div>
        ))}
      </dl>

      {/* Deal ID */}
      <p className="text-[10px] text-blue-400 font-mono">
        Deal ID: {event.ploomes_deal_id}
      </p>
    </section>
  )
}
