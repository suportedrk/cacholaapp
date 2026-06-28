'use client'

import { memo } from 'react'
import Link from 'next/link'
import { parseISO, isToday, isFuture, startOfDay } from 'date-fns'
import { Clock, Users, Phone, Tag, Handshake, AlertTriangle, User, Palette } from 'lucide-react'

export type ConflictType = 'overlap' | 'short_gap' | null
import { EventStatusBadge } from '@/components/shared/event-status-badge'
import { ContractSignedBadge } from '@/components/shared/contract-signed-badge'
import { PloomeBadge } from '@/components/features/ploomes/ploomes-badge'
import { UnitChip } from '@/components/shared/unit-chip'
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

// Retorna true quando o evento não tem checklists e ainda é hoje ou futuro
function showNoChecklistWarning(event: EventCardEvent): boolean {
  if (!('checklists' in event)) return false
  if (event.status === 'lost' || event.status === 'finished' || event.status === 'post_event') return false
  if (event.checklists?.length) return false
  const d = parseISO(event.date)
  return isToday(d) || isFuture(startOfDay(d))
}


interface EventCardProps {
  event: EventCardEvent
  conflictType?: ConflictType
}

export const EventCard = memo(function EventCard({ event, conflictType = null }: EventCardProps) {
  const formatTime  = (t: string) => t.slice(0, 5)
  const isLost      = event.status === 'lost'
  const progress    = calcChecklistProgress(event)
  const noChecklist = showNoChecklistWarning(event)
  const isEventToday = isToday(parseISO(event.date))

  const progressColor =
    progress === null  ? ''
    : progress >= 80  ? 'bg-green-500'
    : progress >= 50  ? 'bg-amber-500'
    :                   'bg-red-500'

  const providerCount  = ('providers_count' in event)
    ? (event as EventForList).providers_count?.[0]?.count ?? 0
    : 0

  const hasContact = !!event.client_phone

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
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{formatTime(event.start_time)} – {formatTime(event.end_time)}</span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end min-w-0">
          {isEventToday && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-primary text-primary-foreground animate-badge-pulse">
              Hoje
            </span>
          )}
          {noChecklist && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium badge-amber border">
              Sem checklist
            </span>
          )}
          {conflictType === 'overlap' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">
              <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
              Sobreposição
            </span>
          )}
          {conflictType === 'short_gap' && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
              <Clock className="h-2.5 w-2.5 shrink-0" />
              Intervalo &lt; 2h
            </span>
          )}
          {event.ploomes_deal_id && <PloomeBadge size="xs" />}
          <ContractSignedBadge signed={event.contract_signed} size="sm" />
          <EventStatusBadge status={event.status} size="sm" />
        </div>
      </div>

      {/* Corpo: informações principais */}
      <div className="flex items-start gap-3">
        {/* Bloco de texto */}
        <div className="flex-1 min-w-0">
          <h3 className={cn(
            'font-semibold text-text-primary text-base leading-tight line-clamp-1',
            'group-hover:text-primary transition-colors',
            isLost && 'line-through text-text-tertiary'
          )}>
            {event.title}
          </h3>
          <p className="text-sm text-text-secondary mt-0.5 line-clamp-1">{event.client_name}</p>

          {/* Vendedora responsável */}
          {event.owner_name && (
            <div className="flex items-center gap-1 mt-0.5">
              <User className="w-3 h-3 text-text-tertiary shrink-0" />
              <span className="text-xs text-text-tertiary line-clamp-1">{event.owner_name}</span>
            </div>
          )}

          {/* Tema da festa — Ploomes */}
          {event.theme && (
            <div className="flex items-center gap-1 mt-1">
              <Tag className="w-3 h-3 text-text-tertiary shrink-0" />
              <span className="text-xs text-text-secondary line-clamp-1">{event.theme}</span>
            </div>
          )}

          {/* Decoradora */}
          <div className="flex items-center gap-1 mt-1">
            <Palette className="w-3 h-3 text-text-tertiary shrink-0" />
            <span className={cn('text-xs line-clamp-1', event.decorator_name ? 'text-text-secondary' : 'text-text-tertiary italic')}>
              {event.decorator_name || 'não preenchido'}
            </span>
          </div>
        </div>
      </div>

      {/* Meta: unidade, convidados, prestadores */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 items-center">
        <UnitChip slug={event.unit?.slug} name={event.unit?.name} size="sm" />
        <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
          <Users className="w-3 h-3 shrink-0" />
          {event.guest_count !== null && event.guest_count !== undefined
            ? `${event.guest_count} convidados`
            : 'não definido'}
        </span>
        {providerCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
            <Handshake className="w-3 h-3 shrink-0" />
            {providerCount} {providerCount === 1 ? 'prestador' : 'prestadores'}
          </span>
        )}
      </div>

      {/* Contato: sempre visível no mobile, expande ao hover no desktop */}
      {hasContact && (
        <div className={cn(
          'overflow-hidden transition-all duration-200 ease-out',
          'max-h-14',                            // sempre visível no mobile
          'sm:max-h-0 sm:group-hover:max-h-14',  // escondido desktop, expande no hover
        )}>
          <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2.5 mt-2.5 border-t border-border">
            {event.client_phone && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `tel:${event.client_phone!.replace(/\D/g, '')}` }}
                className="inline-flex items-center gap-1 text-xs text-text-link hover:underline"
              >
                <Phone className="w-3 h-3 shrink-0" />
                {event.client_phone}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Barra de progresso de checklists */}
      {progress !== null && (
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">Checklists</span>
            <span className="text-xs font-medium text-text-secondary">{progress}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full origin-left animate-progress-fill', progressColor)}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </Link>
  )
})

// ── Skeleton de loading ───────────────────────────────────────
export function EventCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-28 skeleton-shimmer rounded" />
        <div className="h-5 w-20 skeleton-shimmer rounded-full" />
      </div>
      <div className="flex-1 space-y-1.5 mb-3">
        <div className="h-5 w-3/4 skeleton-shimmer rounded" />
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
