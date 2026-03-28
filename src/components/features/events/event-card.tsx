'use client'

import { memo } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar, Clock, MapPin, Users, Package } from 'lucide-react'
import { EventStatusBadge } from '@/components/shared/event-status-badge'
import { PloomeBadge } from '@/components/features/ploomes/ploomes-badge'
import { cn } from '@/lib/utils'
import type { EventWithDetails } from '@/types/database.types'

interface EventCardProps {
  event: EventWithDetails
}

export const EventCard = memo(function EventCard({ event }: EventCardProps) {
  // Formatar data: "Sáb, 12 abr"
  const formattedDate = format(new Date(`${event.date}T00:00:00`), "EEE, d MMM", { locale: ptBR })

  // Formatar hora: "14:00"
  const formatTime = (t: string) => t.slice(0, 5)

  return (
    <Link
      href={`/eventos/${event.id}`}
      className={cn(
        'group block bg-card rounded-xl border border-border p-4',
        'hover:border-primary/40 hover:shadow-md transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
    >
      {/* Header: data + status */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <Calendar className="w-3.5 h-3.5" />
          <span className="capitalize">{formattedDate}</span>
          <span className="mx-0.5 text-border">·</span>
          <Clock className="w-3.5 h-3.5" />
          <span>{formatTime(event.start_time)} – {formatTime(event.end_time)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {event.ploomes_deal_id && <PloomeBadge url={event.ploomes_url} size="xs" />}
          <EventStatusBadge status={event.status} size="sm" />
        </div>
      </div>

      {/* Título e cliente */}
      <div className="mb-3">
        <h3 className="font-semibold text-foreground text-base leading-tight group-hover:text-primary transition-colors line-clamp-1">
          {event.title}
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
          {event.client_name}
          {event.birthday_person && (
            <span className="text-muted-foreground/70"> · {event.birthday_person}{event.birthday_age ? `, ${event.birthday_age} anos` : ''}</span>
          )}
        </p>
      </div>

      {/* Meta: tipo, pacote, salão, convidados */}
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {event.event_type && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
            {event.event_type.name}
          </span>
        )}
        {event.package && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Package className="w-3 h-3" />
            {event.package.name}
          </span>
        )}
        {event.venue && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            {event.venue.name}
          </span>
        )}
        {event.guest_count && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            {event.guest_count} convidados
          </span>
        )}
      </div>

      {/* Equipe (avatares empilhados) */}
      {event.staff.length > 0 && (
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
          <div className="flex -space-x-2">
            {event.staff.slice(0, 4).map((s) => (
              <div
                key={s.id}
                className="w-6 h-6 rounded-full bg-muted border-2 border-card flex items-center justify-center text-xs font-medium text-muted-foreground overflow-hidden"
                title={`${s.user.name} — ${s.role_in_event}`}
              >
                {s.user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.user.avatar_url} alt={s.user.name} className="w-full h-full object-cover" />
                ) : (
                  s.user.name.charAt(0).toUpperCase()
                )}
              </div>
            ))}
          </div>
          {event.staff.length > 4 && (
            <span className="text-xs text-muted-foreground">+{event.staff.length - 4}</span>
          )}
          <span className="text-xs text-muted-foreground ml-auto">
            {event.staff.length} pessoa{event.staff.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </Link>
  )
})

// Skeleton de loading
export function EventCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-4 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="h-4 w-40 bg-muted rounded" />
        <div className="h-5 w-20 bg-muted rounded-full" />
      </div>
      <div className="mb-3">
        <div className="h-5 w-3/4 bg-muted rounded mb-1.5" />
        <div className="h-4 w-1/2 bg-muted rounded" />
      </div>
      <div className="flex gap-3">
        <div className="h-3.5 w-20 bg-muted rounded" />
        <div className="h-3.5 w-16 bg-muted rounded" />
        <div className="h-3.5 w-24 bg-muted rounded" />
      </div>
    </div>
  )
}
