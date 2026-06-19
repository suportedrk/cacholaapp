'use client'

import { useCallback } from 'react'
import { Printer } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Event } from '@/types/database.types'

/** Texto exibido quando um campo não está preenchido (null/vazio) ou aguarda a Fase 2. */
export const NAO_PREENCHIDO = 'não preenchido'

export interface ChecklistClienteItem {
  label: string
  value: string
}

/** Booleano → "Sim"/"Não" (nunca "não preenchido" — o campo é sempre boolean no banco). */
function boolLabel(v: boolean | null | undefined): string {
  return v ? 'Sim' : 'Não'
}

/** Texto/número: null ou string vazia → "não preenchido"; caso contrário, o valor. */
function textValue(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return NAO_PREENCHIDO
  const s = String(v).trim()
  return s === '' ? NAO_PREENCHIDO : s
}

/** Hora TIME 'HH:MM:SS' → 'HH:MM'; null → "não preenchido". */
function timeValue(v: string | null | undefined): string {
  if (!v) return NAO_PREENCHIDO
  return v.slice(0, 5)
}

/**
 * Fonte única dos 21 itens do Checklist do Cliente (ordem + regras de valor).
 * Consumida tanto pela seção quanto por este dialog de impressão.
 * Itens marcados "Fase 2" são placeholders fixos até os campos virem do Ploomes.
 */
export function buildChecklistClienteItems(event: Event): ChecklistClienteItem[] {
  return [
    { label: 'Número de convidados adultos', value: textValue(event.adult_count) },
    { label: 'Número de convidados até 4 anos', value: textValue(event.kids_under4) },
    { label: 'Número de convidados acima de 5 anos', value: textValue(event.kids_over5) },
    { label: 'Decoração alinhada?', value: boolLabel(event.decoration_aligned) },
    { label: 'Comprou doces decorados?', value: boolLabel(event.has_decorated_sweets) },
    { label: 'Teremos algum show?', value: boolLabel(event.has_show) },
    { label: 'Bebidas de fora', value: boolLabel(event.outside_drinks) },
    { label: 'Lembrancinhas', value: boolLabel(event.party_favors) },
    { label: 'Quantidade Rolha', value: NAO_PREENCHIDO },
    { label: 'Valor do Convidado Extra e Staff', value: NAO_PREENCHIDO },
    { label: 'Responsável', value: NAO_PREENCHIDO },
    { label: 'Nome do pai', value: textValue(event.father_name) },
    { label: 'Contratou foto e/ou vídeo?', value: NAO_PREENCHIDO },
    { label: 'Contato(s) foto e/ou vídeo', value: textValue(event.photo_video) },
    { label: 'Horário do Show', value: timeValue(event.show_time) },
    { label: 'Gerador', value: NAO_PREENCHIDO },
    { label: 'Valet custos', value: NAO_PREENCHIDO },
    { label: 'Músicas', value: textValue(event.music) },
    { label: 'Outros detalhes Checklist Cliente', value: NAO_PREENCHIDO },
    { label: 'Pagou Rolha?', value: NAO_PREENCHIDO },
    { label: 'Detalhamento de Hora Extra', value: NAO_PREENCHIDO },
  ]
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  event: Event
  unitName: string | null
}

/**
 * Versão imprimível (A4) do Checklist do Cliente.
 * Espelha o FestaRomaneioPrintDialog: documento branco + window.print() +
 * bloco @media print que isola a área de impressão (id checklist-cliente-print-area).
 */
export function ChecklistClientePrintDialog({ open, onOpenChange, event, unitName }: Props) {
  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const items = buildChecklistClienteItems(event)

  const dataFmt = (() => {
    try {
      return format(parseISO(`${event.date}T00:00:00`), "EEE, d 'de' MMMM 'de' yyyy", {
        locale: ptBR,
      })
    } catch {
      return event.date
    }
  })()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl print:max-w-full print:shadow-none print:border-none">
        <DialogHeader>
          <DialogTitle>Checklist do Cliente</DialogTitle>
          <DialogDescription>
            Pré-visualização do checklist do cliente. Use o botão imprimir para gerar a versão física.
          </DialogDescription>
        </DialogHeader>

        <div
          id="checklist-cliente-print-area"
          className="space-y-4 rounded-lg border border-border-default bg-white p-6 text-black"
        >
          {/* Cabeçalho do documento */}
          <div className="border-b pb-3">
            <h1 className="text-xl font-bold">Checklist do Cliente</h1>
            <p className="text-sm text-neutral-700">{event.title}</p>
          </div>

          {/* Festa / Unidade / Cliente */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Data da festa</p>
              <p className="capitalize">{dataFmt}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Unidade</p>
              <p className="font-semibold">{unitName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Cliente</p>
              <p>{event.client_name ?? '—'}</p>
            </div>
          </div>

          {/* Itens — duas colunas rótulo/valor */}
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
              Itens ({items.length})
            </p>
            <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 print:grid-cols-2">
              {items.map((it) => (
                <div
                  key={it.label}
                  className="flex items-baseline justify-between gap-3 border-b border-neutral-200 py-1.5"
                >
                  <span className="text-sm text-neutral-600">{it.label}</span>
                  <span className="text-right text-sm font-medium text-black">{it.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 print:hidden">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="button" onClick={handlePrint}>
            <Printer className="mr-1.5 h-4 w-4" />
            Imprimir
          </Button>
        </div>

        <style jsx global>{`
          @media print {
            body * {
              visibility: hidden;
            }
            #checklist-cliente-print-area,
            #checklist-cliente-print-area * {
              visibility: visible;
            }
            #checklist-cliente-print-area {
              position: fixed;
              top: 0;
              left: 0;
              width: 100%;
              padding: 16mm;
              border: none !important;
              box-shadow: none !important;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  )
}
