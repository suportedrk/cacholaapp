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
import type { FestaItemLinha } from '@/types/decoracao'

function variacaoLabel(it: FestaItemLinha): string {
  const partes = [it.tamanho, it.cor, it.detalhe].filter(Boolean)
  return partes.length ? partes.join(' / ') : it.codigo
}

export interface FestaRomaneioData {
  eventTitle: string
  eventDate: string // YYYY-MM-DD
  unitName: string | null
  clientName: string | null
  temaNome: string | null
  itens: FestaItemLinha[]
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  data: FestaRomaneioData
}

/**
 * Romaneio imprimível de separação da decoração da festa.
 * Espelha o RomaneioPrintDialog da transferência (Bloco 4): cabeçalho +
 * tabela item/variação/código/qtd + assinaturas. SEM efeito de estoque.
 */
export function FestaRomaneioPrintDialog({ open, onOpenChange, data }: Props) {
  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const totalPecas = data.itens.reduce((acc, it) => acc + it.quantidade, 0)

  const dataFmt = (() => {
    try {
      return format(parseISO(`${data.eventDate}T00:00:00`), "EEE, d 'de' MMMM 'de' yyyy", {
        locale: ptBR,
      })
    } catch {
      return data.eventDate
    }
  })()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl print:max-w-full print:shadow-none print:border-none">
        <DialogHeader>
          <DialogTitle>Romaneio de decoração</DialogTitle>
          <DialogDescription>
            Pré-visualização do romaneio de separação. Use o botão imprimir para gerar a versão física.
          </DialogDescription>
        </DialogHeader>

        <div
          id="romaneio-festa-print-area"
          className="space-y-4 rounded-lg border border-border-default bg-white p-6 text-black"
        >
          {/* Cabeçalho do documento */}
          <div className="border-b pb-3">
            <h1 className="text-xl font-bold">Romaneio de Decoração</h1>
            <p className="text-sm text-neutral-700">{data.eventTitle}</p>
          </div>

          {/* Festa / Tema */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Data da festa</p>
              <p className="capitalize">{dataFmt}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Unidade</p>
              <p className="font-semibold">{data.unitName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Cliente</p>
              <p>{data.clientName ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Tema</p>
              <p className="font-semibold">{data.temaNome ?? '—'}</p>
            </div>
          </div>

          {/* Tabela de itens */}
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
              Itens ({data.itens.length})
            </p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-neutral-300 text-left text-xs uppercase tracking-wide text-neutral-500">
                  <th className="py-2 pr-2 font-medium">Item</th>
                  <th className="py-2 pr-2 font-medium">Variação</th>
                  <th className="py-2 pr-2 font-medium">Código</th>
                  <th className="py-2 pl-2 text-right font-medium">Qtd.</th>
                </tr>
              </thead>
              <tbody>
                {data.itens.map((it) => (
                  <tr key={it.variacao_id} className="border-b border-neutral-200">
                    <td className="py-1.5 pr-2">{it.item_nome}</td>
                    <td className="py-1.5 pr-2">{variacaoLabel(it)}</td>
                    <td className="py-1.5 pr-2 font-mono text-xs">{it.codigo}</td>
                    <td className="py-1.5 pl-2 text-right font-semibold">{it.quantidade}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} className="pt-2 text-right font-semibold">
                    Total
                  </td>
                  <td className="pt-2 text-right font-bold">{totalPecas}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Assinaturas */}
          <div className="mt-8 grid grid-cols-2 gap-6 text-xs text-neutral-700 print:mt-12">
            <div>
              <div className="mb-1 h-12 border-b border-neutral-400" />
              <p>Separado por</p>
            </div>
            <div>
              <div className="mb-1 h-12 border-b border-neutral-400" />
              <p>Conferido por</p>
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
            #romaneio-festa-print-area,
            #romaneio-festa-print-area * {
              visibility: visible;
            }
            #romaneio-festa-print-area {
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
