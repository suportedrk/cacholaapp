'use client'

import Link from 'next/link'
import { Calendar, ExternalLink } from 'lucide-react'
import { format, parseISO, isPast } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/providers'
import { EVENT_PROVIDER_STATUS_LABELS } from '@/types/providers'
import { StarRating } from '../../../components/StarRating'
import { AccordionSection } from '../AccordionSection'
import type { ProviderEventItem } from '@/hooks/use-providers'
import type { ProviderRating } from '@/types/providers'

// ── Status dot colors ────────────────────────────────────────
const STATUS_DOT: Record<string, string> = {
  completed: 'bg-green-500',
  confirmed: 'bg-amber-500',
  pending:   'bg-amber-400',
  cancelled: 'bg-red-500',
}

// ─────────────────────────────────────────────────────────────
// Single event row
// ─────────────────────────────────────────────────────────────
function EventRow({
  ep,
  rating,
}: {
  ep: ProviderEventItem
  rating?: ProviderRating
}) {
  const event = ep.event
  if (!event) return null

  const dateLabel = event.date
    ? format(parseISO(event.date), "d 'de' MMM 'de' yyyy", { locale: ptBR })
    : null

  const isCompleted = ep.status === 'completed'
  const isCancelled = ep.status === 'cancelled'
  const isFuture = event.date ? !isPast(parseISO(event.date + 'T23:59:59')) : false

  const dotClass = STATUS_DOT[ep.status] ?? 'bg-muted-foreground'
  const statusLabel = EVENT_PROVIDER_STATUS_LABELS[ep.status]

  return (
    <Link
      href={`/eventos/${event.id}`}
      className={cn(
        'flex items-start gap-3 rounded-lg border border-border bg-card p-3 hover:bg-muted/30 transition-colors group',
        isCancelled && 'opacity-60',
      )}
    >
      {/* Status dot */}
      <div className="mt-1 shrink-0">
        <span className={cn('w-2.5 h-2.5 rounded-full block', dotClass)} />
      </div>

      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-1">
          <p className={cn(
            'text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate',
            isCancelled && 'line-through',
          )}>
            {event.title ?? 'Evento'}
          </p>
          <ExternalLink className="w-3 h-3 text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {dateLabel && (
            <span className="text-xs text-muted-foreground">{dateLabel}</span>
          )}
          {ep.category && (
            <>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs text-muted-foreground">
                {ep.category.icon} {ep.category.name}
              </span>
            </>
          )}
          {ep.agreed_price != null && ep.agreed_price > 0 && (
            <>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="text-xs font-medium text-foreground">
                {formatCurrency(ep.agreed_price)}
              </span>
            </>
          )}
        </div>

        {/* Rating inline */}
        {rating ? (
          <div className="flex items-center gap-1.5 pt-0.5">
            <StarRating rating={rating.rating} size="sm" showValue />
            {rating.comment && (
              <span className="text-xs text-muted-foreground/70 italic truncate max-w-[180px]">
                &ldquo;{rating.comment}&rdquo;
              </span>
            )}
          </div>
        ) : isCompleted ? (
          <span className="text-xs text-muted-foreground/60 italic">Aguardando avaliação</span>
        ) : null}
      </div>

      <span className="shrink-0 self-center text-xs text-muted-foreground/60">
        {statusLabel}
      </span>
    </Link>
  )
}

// ─────────────────────────────────────────────────────────────
// Section
// ─────────────────────────────────────────────────────────────
interface Props {
  eventProviders: ProviderEventItem[]
  ratings: ProviderRating[]
}

export function EventHistorySection({ eventProviders, ratings }: Props) {
  if (eventProviders.length === 0) return null

  // Build rating map by event_id for fast lookup
  const ratingByEventId = new Map<string, ProviderRating>()
  for (const r of ratings) {
    ratingByEventId.set(r.event_id, r)
  }

  // Sort by event date DESC
  const sorted = [...eventProviders].sort((a, b) => {
    const da = a.event?.date ?? ''
    const db = b.event?.date ?? ''
    return db.localeCompare(da)
  })

  return (
    <AccordionSection
      title="Histórico de Festas"
      icon={Calendar}
      badge={eventProviders.length}
      defaultOpen
    >
      <div className="space-y-2">
        {sorted.map((ep) => (
          <EventRow
            key={ep.id}
            ep={ep}
            rating={ep.event_id ? ratingByEventId.get(ep.event_id) : undefined}
          />
        ))}
      </div>
    </AccordionSection>
  )
}
