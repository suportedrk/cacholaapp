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
  RESTRITO,
} from './ChecklistClientePrintDialog'
import type { Event } from '@/types/database.types'

interface EventChecklistClienteSectionProps {
  event: Event
  unitName: string | null
  canSeeValues: boolean
}

/**
 * Seção SOMENTE LEITURA "Checklist do Cliente" — espelho de campos do Ploomes
 * presentes na tabela events. Todos os 21 itens estão ligados a dados reais;
 * "não preenchido" só aparece quando o campo está vazio no banco.
 *
 * Layout: campos curtos usam rótulo ↔ valor na mesma linha (2 colunas);
 * campos longos (multiline) usam largura total com rótulo acima e valor abaixo,
 * com quebra de palavra para URLs e textos livres longos.
 *
 * O campo financeiro ("Valor do Convidado Extra e Staff") é restrito por cargo
 * via canSeeValues (canViewFestaValues) e exibe "Restrito" quando false.
 */
export function EventChecklistClienteSection({ event, unitName, canSeeValues }: EventChecklistClienteSectionProps) {
  const [printOpen, setPrintOpen] = useState(false)
  const items = buildChecklistClienteItems(event, canSeeValues)

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

          <dl className="grid grid-cols-1 gap-x-6 gap-y-0 sm:grid-cols-2">
            {items.map((it) => {
              const isEmpty = it.value === NAO_PREENCHIDO
              const isRestricted = it.restricted === true || it.value === RESTRITO

              if (it.multiline) {
                /* Campo longo: ocupa largura total, rótulo acima, valor abaixo */
                return (
                  <div
                    key={it.label}
                    className="sm:col-span-2 border-b border-border/60 py-1.5"
                  >
                    <dt className="text-xs text-text-secondary mb-0.5">{it.label}</dt>
                    <dd
                      className={cn(
                        'text-sm font-medium [overflow-wrap:anywhere] whitespace-pre-wrap',
                        isEmpty ? 'text-text-tertiary italic' : 'text-text-primary',
                      )}
                    >
                      {it.value}
                    </dd>
                  </div>
                )
              }

              /* Campo curto: layout compacto rótulo ↔ valor */
              return (
                <div
                  key={it.label}
                  className="flex items-baseline justify-between gap-3 border-b border-border/60 py-1.5"
                >
                  <dt className="text-sm text-text-secondary shrink-0">{it.label}</dt>
                  <dd
                    className={cn(
                      'text-right text-sm font-medium break-words',
                      isRestricted
                        ? 'text-text-tertiary'
                        : isEmpty
                          ? 'text-text-tertiary italic'
                          : 'text-text-primary',
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
        canSeeValues={canSeeValues}
      />
    </>
  )
}
