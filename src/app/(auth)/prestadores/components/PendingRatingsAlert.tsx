'use client'

import { useState, useEffect } from 'react'
import { Star, ChevronRight, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { ProviderAvatar } from './ProviderAvatar'
import { RatingFormCard } from './RatingFormCard'
import { usePendingRatings } from '@/hooks/use-provider-ratings'
import { useUnitStore } from '@/stores/unit-store'
import type { EventProvider } from '@/types/providers'

const SESSION_KEY = 'cachola-pending-ratings-dismissed'

interface Props {
  pendingCount: number
}

export function PendingRatingsAlert({ pendingCount }: Props) {
  const [dismissed, setDismissed]   = useState(false)
  const [expanded, setExpanded]     = useState(false)
  const [ratingFor, setRatingFor]   = useState<EventProvider | null>(null)
  const { activeUnitId }            = useUnitStore()

  const { data: pendingList = [] } = usePendingRatings()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDismissed(sessionStorage.getItem(SESSION_KEY) === '1')
    }
  }, [])

  if (pendingCount <= 0 || dismissed) return null

  function handleDismiss() {
    sessionStorage.setItem(SESSION_KEY, '1')
    setDismissed(true)
  }

  return (
    <>
      <div className="rounded-xl border border-primary/20 bg-brand-50 dark:bg-brand-900/20 dark:border-primary/30 overflow-hidden">
        {/* Banner */}
        <div className="flex items-start gap-3 p-4">
          <div className="icon-brand mt-0.5 shrink-0">
            <Star className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary">
              {pendingCount === 1
                ? 'Você tem 1 avaliação pendente'
                : `Você tem ${pendingCount} avaliações pendentes`}
            </p>
            <p className="text-xs text-text-secondary mt-0.5">
              Prestadores de festas recentes aguardam sua avaliação.
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {expanded ? 'Fechar' : 'Ver pendentes'}
              <ChevronRight className={cn('w-3 h-3 transition-transform', expanded && 'rotate-90')} />
            </button>
            <button
              onClick={handleDismiss}
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-primary/10 transition-colors text-text-tertiary ml-1"
              aria-label="Dispensar alerta"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Lista expandida */}
        {expanded && pendingList.length > 0 && (
          <div className="border-t border-primary/15 divide-y divide-border/60">
            {pendingList.slice(0, 5).map((rawEp) => {
              const ep = rawEp as unknown as EventProvider
              const provider = ep.provider
              if (!provider) return null
              const eventDate = ep.event?.date
                ? format(parseISO(ep.event.date), "d 'de' MMM", { locale: ptBR })
                : null

              return (
                <div key={ep.id} className="flex items-center gap-3 px-4 py-3 bg-card/40">
                  <ProviderAvatar name={provider.name} size="sm" className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {provider.name}
                    </p>
                    <p className="text-xs text-text-tertiary truncate">
                      {ep.event?.title ?? 'Evento'}{eventDate ? ` · ${eventDate}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setRatingFor(ep)}
                    className="shrink-0 text-xs font-medium text-primary hover:underline"
                  >
                    Avaliar
                  </button>
                </div>
              )
            })}
            {pendingList.length > 5 && (
              <p className="px-4 py-2 text-xs text-text-tertiary text-center bg-card/20">
                +{pendingList.length - 5} mais pendente{pendingList.length - 5 > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Rating modal */}
      {ratingFor && ratingFor.provider && (
        <RatingFormCard
          eventProviderId={ratingFor.id}
          providerId={ratingFor.provider_id}
          providerName={ratingFor.provider.name}
          eventId={ratingFor.event_id}
          eventTitle={ratingFor.event?.title ?? 'Evento'}
          eventDate={ratingFor.event?.date}
          unitId={activeUnitId ?? ratingFor.unit_id}
          onSuccess={() => setRatingFor(null)}
          onCancel={() => setRatingFor(null)}
        />
      )}
    </>
  )
}
