'use client'

import { ClipboardCheck, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AccordionSection } from '../AccordionSection'
import {
  buildChecklistClienteItems,
  openChecklistClientePrint,
  NAO_PREENCHIDO,
  RESTRITO,
} from './checklist-cliente-print'
import type { Event } from '@/types/database.types'

interface EventChecklistClienteSectionProps {
  event: Event
  unitName: string | null
  canSeeValues: boolean
}

export function EventChecklistClienteSection({ event, unitName, canSeeValues }: EventChecklistClienteSectionProps) {
  const items = buildChecklistClienteItems(event, canSeeValues)

  return (
    <AccordionSection title="Checklist do Cliente" icon={ClipboardCheck}>
      <div className="space-y-3">
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => openChecklistClientePrint({ event, unitName, canSeeValues })}
          >
            <Printer className="h-3.5 w-3.5" />
            Imprimir
          </Button>
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-0 sm:grid-cols-2">
          {items.map((it) => {
            const isEmpty = it.value === NAO_PREENCHIDO
            const isRestricted = it.restricted === true || it.value === RESTRITO

            if (it.multiline) {
              return (
                <div key={it.label} className="sm:col-span-2 border-b border-border/60 py-1.5">
                  <dt className="text-xs text-text-secondary mb-0.5">{it.label}</dt>
                  <dd className={cn('text-sm font-medium [overflow-wrap:anywhere] whitespace-pre-wrap', isEmpty ? 'text-text-tertiary italic' : 'text-text-primary')}>
                    {it.value}
                  </dd>
                </div>
              )
            }

            return (
              <div key={it.label} className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5">
                <dt className="text-sm text-text-secondary shrink-0">{it.label}</dt>
                <dd className={cn('text-right text-sm font-medium break-words', isRestricted ? 'text-text-tertiary' : isEmpty ? 'text-text-tertiary italic' : 'text-text-primary')}>
                  {it.value}
                </dd>
              </div>
            )
          })}
        </dl>
      </div>
    </AccordionSection>
  )
}
