'use client'

import { useState } from 'react'
import { Star, CheckCircle2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { StarRating } from '@/app/(auth)/prestadores/components/StarRating'
import { RatingFormCard } from '@/app/(auth)/prestadores/components/RatingFormCard'
import { useUnitStore } from '@/stores/unit-store'
import type { EventProvider, ProviderRating } from '@/types/providers'

interface Props {
  ep: EventProvider
  rating?: ProviderRating
  eventTitle: string
  eventDate: string  // 'YYYY-MM-DD'
}

export function EventProviderRatingSection({ ep, rating, eventTitle, eventDate }: Props) {
  const [formOpen, setFormOpen] = useState(false)
  const { activeUnitId }        = useUnitStore()

  if (ep.status !== 'completed') return null
  if (!ep.provider) return null

  // ── Já avaliado ──────────────────────────────────────────
  if (rating) {
    return (
      <div className="mx-0 -mt-1 px-3 py-2.5 rounded-b-lg border-x border-b border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0" />
          <StarRating rating={rating.rating} size="sm" showValue />
          {rating.comment && (
            <span className="text-xs text-text-secondary italic truncate flex-1 min-w-0">
              &quot;{rating.comment}&quot;
            </span>
          )}
        </div>
        {rating.rated_by_user && (
          <p className="text-[11px] text-text-tertiary mt-0.5 pl-5">
            Avaliado por {(rating.rated_by_user as { name?: string | null }).name ?? 'alguém'}{' '}
            em {format(parseISO(rating.created_at), "d 'de' MMM", { locale: ptBR })}
          </p>
        )}
      </div>
    )
  }

  // ── Pendente de avaliação ─────────────────────────────────
  return (
    <>
      <div className="mx-0 -mt-1 px-3 py-2 rounded-b-lg border-x border-b border-dashed border-amber-300 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Star className="w-3 h-3 text-amber-500 shrink-0" />
            <p className="text-xs text-text-secondary">Como foi a experiência nesta festa?</p>
          </div>
          <button
            onClick={() => setFormOpen(true)}
            className="shrink-0 text-xs font-medium text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 underline underline-offset-2"
          >
            Avaliar agora
          </button>
        </div>
      </div>

      {formOpen && (
        <RatingFormCard
          eventProviderId={ep.id}
          providerId={ep.provider_id}
          providerName={ep.provider.name}
          eventId={ep.event_id}
          eventTitle={eventTitle}
          eventDate={eventDate}
          unitId={activeUnitId ?? ep.unit_id}
          onSuccess={() => setFormOpen(false)}
          onCancel={() => setFormOpen(false)}
        />
      )}
    </>
  )
}
