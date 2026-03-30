'use client'

import { useState } from 'react'
import { Handshake, Plus } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/providers'
import { useEventProviders } from '@/hooks/use-event-providers'
import { AccordionSection } from '../AccordionSection'
import { EventProviderCard } from '../EventProviderCard'
import { AddProviderModal } from '../AddProviderModal'

interface Props {
  eventId: string
  eventDate: string  // 'YYYY-MM-DD'
}

export function ProvidersSection({ eventId, eventDate }: Props) {
  const [addOpen, setAddOpen] = useState(false)
  const { data: eventProviders = [], isLoading } = useEventProviders(eventId)

  // Total estimated cost — sum per_event providers with a price
  const totalEstimated = eventProviders.reduce((sum, ep) => {
    if (ep.price_type === 'per_event' && ep.agreed_price != null) {
      return sum + ep.agreed_price
    }
    return sum
  }, 0)

  const existingProviderIds = eventProviders.map((ep) => ep.provider_id)

  return (
    <>
      <AccordionSection
        title="Prestadores"
        icon={Handshake}
        badge={eventProviders.length > 0 ? eventProviders.length : undefined}
      >
        {isLoading && (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        )}

        {!isLoading && eventProviders.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Handshake className="w-7 h-7 text-text-tertiary/40" />
            <p className="text-sm text-text-secondary">Nenhum prestador neste evento.</p>
          </div>
        )}

        {!isLoading && eventProviders.length > 0 && (
          <div className="space-y-2">
            {eventProviders.map((ep) => (
              <EventProviderCard key={ep.id} ep={ep} />
            ))}

            {/* Total estimado */}
            {totalEstimated > 0 && (
              <div className="flex items-center justify-between pt-2 mt-2 border-t border-border">
                <span className="text-xs text-text-tertiary">Total estimado (por evento)</span>
                <span className="text-sm font-semibold text-text-primary">
                  {formatCurrency(totalEstimated)}
                </span>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="w-full mt-3 h-9 rounded-lg border border-dashed border-border text-sm text-text-secondary hover:text-text-primary hover:border-primary/50 hover:bg-muted/30 transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar Prestador
        </button>
      </AccordionSection>

      {addOpen && (
        <AddProviderModal
          eventId={eventId}
          eventDate={eventDate}
          existingProviderIds={existingProviderIds}
          onClose={() => setAddOpen(false)}
        />
      )}
    </>
  )
}
