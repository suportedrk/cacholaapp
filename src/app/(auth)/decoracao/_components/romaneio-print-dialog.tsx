'use client'

import { useCallback } from 'react'
import { Printer } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { TransferenciaComItens, TransferenciaItemHidratado } from '@/types/decoracao'

function variacaoLabel(it: TransferenciaItemHidratado): string {
  const partes = [it.variacao_tamanho, it.variacao_cor, it.variacao_detalhe].filter(Boolean)
  return partes.length ? partes.join(' / ') : it.variacao_codigo
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  transferencia: TransferenciaComItens
}

export function RomaneioPrintDialog({ open, onOpenChange, transferencia }: Props) {
  const t = transferencia
  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const totalPecas = t.itens.reduce((acc, it) => acc + it.quantidade, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl print:max-w-full print:shadow-none print:border-none">
        <DialogHeader>
          <DialogTitle>Romaneio de transferência</DialogTitle>
          <DialogDescription>
            Pré-visualização do romaneio. Use o botão imprimir para gerar a versão física.
          </DialogDescription>
        </DialogHeader>

        <div
          id="romaneio-print-area"
          className="space-y-4 rounded-lg border border-border-default bg-white p-6 text-black"
        >
          {/* Cabeçalho do documento */}
          <div className="border-b pb-3">
            <h1 className="text-xl font-bold">Romaneio de Transferência</h1>
            <p className="font-mono text-xs text-neutral-600">#{t.id.slice(0, 8)}</p>
          </div>

          {/* Origem / Destino / Datas */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Origem</p>
              <p className="text-base font-semibold">{t.origem_nome}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Destino</p>
              <p className="text-base font-semibold">{t.destino_nome}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Data de envio</p>
              <p>{formatDateTime(t.data_envio)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-500">Lançada por</p>
              <p>{t.created_by_nome ?? '—'}</p>
            </div>
            {t.observacoes && (
              <div className="col-span-2">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Observações</p>
                <p className="whitespace-pre-wrap">{t.observacoes}</p>
              </div>
            )}
          </div>

          {/* Tabela de itens */}
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">
              Itens ({t.itens.length})
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
                {t.itens.map((it) => (
                  <tr key={it.id} className="border-b border-neutral-200">
                    <td className="py-1.5 pr-2">{it.item_nome}</td>
                    <td className="py-1.5 pr-2">{variacaoLabel(it)}</td>
                    <td className="py-1.5 pr-2 font-mono text-xs">{it.variacao_codigo}</td>
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
              <p>Entregue por</p>
            </div>
            <div>
              <div className="mb-1 h-12 border-b border-neutral-400" />
              <p>Recebido por</p>
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
            #romaneio-print-area,
            #romaneio-print-area * {
              visibility: visible;
            }
            #romaneio-print-area {
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
