'use client'

import { memo } from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Clock, MapPin, Users, Package, Cake } from 'lucide-react'
import { EventStatusBadge } from '@/components/shared/event-status-badge'
import { PloomeBadge } from '@/components/features/ploomes/ploomes-badge'
import { cn } from '@/lib/utils'
import type { EventWithDetails, EventForList } from '@/types/database.types'

// EventCard aceita ambos os tipos — EventForList (lista principal) e EventWithDetails (legado)
type EventCardEvent = EventWithDetails | EventForList

// Calcula progresso dos checklists para EventForList
function calcChecklistProgress(event: EventCardEvent): number | null {
  if (!('checklists' in event) || !event.checklists?.length) return null
  const allItems = event.checklists.flatMap((c) => c.checklist_items)
  if (allItems.length === 0) return null
  const done = allItems.filter((i) => i.status === 'done').length
  return Math.round((done / allItems.length) * 100)
}

interface EventCardProps {
  event: EventCardEvent
}

export const EventCard = memo(function EventCard({ event }: EventCardProps) {
  const formatTime = (t: string) => t.slice(0, 5)
  const isLost     = event.status === 'lost'
  const progress   = calcChecklistProgress(event)

  const progressColor =
    progress === null   ? ''
    : progress >= 80   ? 'bg-green-500'
    : progress >= 50   ? 'bg-amber-500'
    :                    'bg-red-500'

  return (
    <Link
      href={`/eventos/${event.id}`}
      className={cn(
        'group block bg-card rounded-xl border border-border p-4',
        'hover:border-primary/40 card-interactive',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isLost && 'opacity-60'
      )}
    >
      {/* Linha 1: horário + badges */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{formatTime(event.start_time)} – {formatTime(event.end_time)}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {event.ploomes_deal_id && <PloomeBadge size="xs" />}
          <EventStatusBadge status={event.status} size="sm" />
        </div>
      </div>

      {/* Título: aniversariante ou título do evento */}
      <div className="mb-2">
        <h3 className={cn(
          'font-semibold text-foreground text-base leading-tight group-hover:text-primary transition-colors line-clamp-1',
          isLost && 'line-through text-muted-foreground'
        )}>
          {event.birthday_person
            ? `${event.birthday_person}${event.birthday_age ? ` · ${event.birthday_age} anos` : ''}`
            : event.title}
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
          {event.client_name}
          {event.birthday_person && event.birthday_person !== event.title && (
            <span className="text-muted-foreground/70"> · {event.title}</span>
          )}
        </p>
      </div>

      {/* Meta: tema (package), salão, convidados */}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {event.event_type && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
            {event.event_type.name}
          </span>
        )}
        {event.package && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Package className="w-3 h-3 shrink-0" />
            {event.package.name}
          </span>
        )}
        {event.venue && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3 shrink-0" />
            {event.venue.name}
          </span>
        )}
        {event.guest_count && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3 h-3 shrink-0" />
            {event.guest_count} convidados
          </span>
        )}
      </div>

      {/* Barra de progresso de checklists (só se houver itens) */}
      {progress !== null && (
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Cake className="w-3 h-3" />
              Checklists
            </span>
            <span className="text-xs font-medium text-muted-foreground">{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', progressColor)}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Equipe (avatares empilhados) — só se sem barra de progresso para não poluir */}
      {progress === null && event.staff.length > 0 && (
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
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-start justify-between mb-2.5">
        <div className="h-4 w-28 skeleton-shimmer rounded" />
        <div className="h-5 w-20 skeleton-shimmer rounded-full" />
      </div>
      <div className="mb-2">
        <div className="h-5 w-3/4 skeleton-shimmer rounded mb-1.5" />
        <div className="h-4 w-1/2 skeleton-shimmer rounded" />
      </div>
      <div className="flex gap-3">
        <div className="h-3.5 w-20 skeleton-shimmer rounded" />
        <div className="h-3.5 w-16 skeleton-shimmer rounded" />
        <div className="h-3.5 w-24 skeleton-shimmer rounded" />
      </div>
    </div>
  )
}
