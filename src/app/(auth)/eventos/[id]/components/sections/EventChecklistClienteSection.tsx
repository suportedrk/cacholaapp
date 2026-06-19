'use client'

import { useState } from 'react'
import { ClipboardCheck, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AccordionSection } from '../AccordionSection'
import {
  ChecklistClientePrintDialog,
  buildChecklistClienteItems,
  NAO_PREENCHIDO,
} from './ChecklistClientePrintDialog'
import type { Event } from '@/types/database.types'

interface EventChecklistClienteSectionProps {
  event: Event
  unitName: string | null
}

/**
 * Seção SOMENTE LEITURA "Checklist do Cliente" — espelho de campos do Ploomes já
 * presentes na tabela events. Fase 1: 12 campos reais + 9 placeholders ("não
 * preenchido") aguardando a Fase 2 (campos a trazer do Ploomes). Sem edição,
 * sem data fetching — recebe tudo via props.
 */
export function EventChecklistClienteSection({ event, unitName }: EventChecklistClienteSectionProps) {
  const [printOpen, setPrintOpen] = useState(false)
  const items = buildChecklistClienteItems(event)

  return (
    <>
      <AccordionSection title="Checklist do Cliente" icon={ClipboardCheck}>
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setPrintOpen(true)}
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </Button>
          </div>

          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {items.map((it) => {
              const isEmpty = it.value === NAO_PREENCHIDO
              return (
                <div
                  key={it.label}
                  className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5"
                >
                  <dt className="text-sm text-text-secondary">{it.label}</dt>
                  <dd
                    className={cn(
                      'text-right text-sm font-medium',
                      isEmpty ? 'text-text-tertiary italic' : 'text-text-primary',
                    )}
                  >
                    {it.value}
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>
      </AccordionSection>

      <ChecklistClientePrintDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        event={event}
        unitName={unitName}
      />
    </>
  )
}
