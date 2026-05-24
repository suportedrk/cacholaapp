'use client'

import { useCallback } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Printer } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  codigo: string
  itemNome: string
  variacaoDescricao: string
}

export function QrPrintModal({ open, onOpenChange, codigo, itemNome, variacaoDescricao }: Props) {
  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md print:max-w-full print:shadow-none print:border-none">
        <DialogHeader>
          <DialogTitle>Etiqueta — {codigo}</DialogTitle>
          <DialogDescription>
            Imprima a etiqueta e cole no item físico para leitura futura.
          </DialogDescription>
        </DialogHeader>

        <div
          id="qr-print-area"
          className="flex flex-col items-center justify-center gap-4 rounded-lg border border-border-default bg-white p-8 text-center"
        >
          <QRCodeSVG value={codigo} size={220} includeMargin level="M" />
          <div className="space-y-1">
            <p className="text-lg font-semibold text-black">{itemNome}</p>
            {variacaoDescricao && (
              <p className="text-sm text-neutral-700">{variacaoDescricao}</p>
            )}
            <p className="text-base font-mono font-medium text-black">{codigo}</p>
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
            body * { visibility: hidden; }
            #qr-print-area, #qr-print-area * { visibility: visible; }
            #qr-print-area {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              border: none !important;
              box-shadow: none !important;
            }
          }
        `}</style>
      </DialogContent>
    </Dialog>
  )
}
