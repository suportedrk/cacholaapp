'use client'

import { StickyNote } from 'lucide-react'
import { AccordionSection } from '../AccordionSection'
import type { ServiceProviderWithDetails } from '@/types/providers'

interface Props {
  provider: ServiceProviderWithDetails
}

export function NotesSection({ provider }: Props) {
  const hasTags = provider.tags && provider.tags.length > 0
  const hasNotes = !!provider.notes?.trim()

  if (!hasTags && !hasNotes) return null

  return (
    <AccordionSection title="Observações Internas" icon={StickyNote}>
      <div className="space-y-3">
        {hasTags && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {provider.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium badge-gray border"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {hasNotes && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Observações</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {provider.notes}
            </p>
          </div>
        )}
      </div>
    </AccordionSection>
  )
}
