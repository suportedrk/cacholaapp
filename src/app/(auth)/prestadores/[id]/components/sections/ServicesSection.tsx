'use client'

import { Briefcase } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/providers'
import { PRICE_TYPE_LABELS } from '@/types/providers'
import { AccordionSection } from '../AccordionSection'
import type { ProviderService, ServiceCategory } from '@/types/providers'

// ─────────────────────────────────────────────────────────────
// Service card
// ─────────────────────────────────────────────────────────────
function ServiceCard({ service }: { service: ProviderService & { category?: ServiceCategory | null } }) {
  const cat = service.category
  const priceLabel = PRICE_TYPE_LABELS[service.price_type]

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 space-y-1.5">
      <div className="flex items-center gap-2">
        {/* Category icon badge */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
          style={{ background: cat?.color ? `${cat.color}20` : undefined }}
        >
          <span role="img" aria-label={cat?.name}>{cat?.icon ?? '🔧'}</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{cat?.name ?? 'Serviço'}</p>
          <p className="text-xs text-muted-foreground">
            {priceLabel}
            {service.price_value != null && service.price_value > 0 && (
              <> · <span className="font-medium text-foreground">{formatCurrency(service.price_value)}</span></>
            )}
          </p>
        </div>
      </div>

      {service.description && (
        <p className="text-xs text-muted-foreground/70 italic pl-11">
          &ldquo;{service.description}&rdquo;
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Section
// ─────────────────────────────────────────────────────────────
interface Props {
  services: (ProviderService & { category?: ServiceCategory | null })[]
}

export function ServicesSection({ services }: Props) {
  if (services.length === 0) return null

  return (
    <AccordionSection title="Serviços e Valores" icon={Briefcase} badge={services.length} defaultOpen>
      <div className="space-y-2">
        {services.map((s) => (
          <ServiceCard key={s.id} service={s} />
        ))}
      </div>
    </AccordionSection>
  )
}
