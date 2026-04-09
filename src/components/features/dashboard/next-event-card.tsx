import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowRight, Calendar, Clock, MapPin, Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { EventStatusBadge } from '@/components/shared/event-status-badge'
import { UserAvatar } from '@/components/shared/user-avatar'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { EventWithDetails } from '@/types/database.types'

interface NextEventCardProps {
  event: EventWithDetails | null | undefined
  isLoading: boolean
}

export function NextEventCard({ event, isLoading }: NextEventCardProps) {
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full shrink-0" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 text-muted-foreground">
        <Calendar className="w-5 h-5 shrink-0" />
        <p className="text-sm">Nenhum evento próximo agendado.</p>
      </div>
    )
  }

  const formattedDate = format(
    new Date(`${event.date}T00:00:00`),
    "EEE, d 'de' MMMM",
    { locale: ptBR }
  )
  const formatTime = (t: string) => t.slice(0, 5)

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      {/* Título + badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Próximo Evento
          </p>
          <h3 className="mt-1 text-base font-semibold text-foreground leading-tight truncate">
            {event.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.client_name}</p>
        </div>
        <EventStatusBadge status={event.status} size="sm" className="shrink-0 mt-1" />
      </div>

      {/* Detalhes */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-3.5 h-3.5 shrink-0" />
          <span className="capitalize">{formattedDate}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{formatTime(event.start_time)} – {formatTime(event.end_time)}</span>
        </div>
        {event.guest_count && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span>{event.guest_count} convidados</span>
          </div>
        )}
      </div>

      {/* Equipe */}
      {event.staff.length > 0 && (
        <div className="flex items-center gap-1.5 pt-0.5">
          <div className="flex -space-x-1.5">
            {event.staff.slice(0, 5).map((s) => (
              <UserAvatar
                key={s.id}
                name={s.user.name}
                avatarUrl={s.user.avatar_url}
                size="sm"
                className="border-2 border-card"
              />
            ))}
          </div>
          {event.staff.length > 5 && (
            <span className="text-xs text-muted-foreground">
              +{event.staff.length - 5}
            </span>
          )}
        </div>
      )}

      {/* Link para detalhe */}
      <Link
        href={`/eventos/${event.id}`}
        className={cn(
          buttonVariants({ variant: 'outline', size: 'sm' }),
          'w-full justify-between'
        )}
      >
        Ver evento completo
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}
