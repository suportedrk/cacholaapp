'use client'

import { useState, useRef } from 'react'
import { Camera, Loader2, X, FileText, Image as ImageIcon } from 'lucide-react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  useSubmitCost, useUploadReceipt, COST_TYPE_LABELS,
} from '@/hooks/use-maintenance-costs'
import type { MaintenanceCostType } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// CURRENCY MASK
// ─────────────────────────────────────────────────────────────
function maskCurrency(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  const cents  = parseInt(digits || '0', 10)
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function parseCurrency(display: string): number {
  return parseFloat(display.replace(/\./g, '').replace(',', '.')) || 0
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
interface Props {
  open:        boolean
  onOpenChange:(v: boolean) => void
  orderId:     string
}

export function QuickCostSheet({ open, onOpenChange, orderId }: Props) {
  const [amountDisplay, setAmountDisplay] = useState('0,00')
  const [costType,      setCostType]      = useState<MaintenanceCostType | ''>('')
  const [description,   setDescription]  = useState('')
  const [receiptFile,   setReceiptFile]   = useState<File | null>(null)
  const [uploadPct,     setUploadPct]     = useState(0)
  const [isUploading,   setIsUploading]   = useState(false)
  const [errors,        setErrors]        = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const submitCost    = useSubmitCost()
  const uploadReceipt = useUploadReceipt()

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    setAmountDisplay(maskCurrency(e.target.value))
    if (errors.amount) setErrors((p) => ({ ...p, amount: '' }))
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setReceiptFile(file)
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (parseCurrency(amountDisplay) <= 0) errs.amount = 'Informe um valor'
    if (!costType)                         errs.type   = 'Selecione o tipo'
    if (!description.trim())               errs.desc   = 'Descreva o gasto'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return

    let receiptUrl: string | null = null
    if (receiptFile) {
      setIsUploading(true)
      try {
        receiptUrl = await uploadReceipt.mutateAsync({ file: receiptFile, onProgress: setUploadPct })
      } catch { setIsUploading(false); return }
      setIsUploading(false)
      setUploadPct(0)
    }

    await submitCost.mutateAsync({
      order_id:    orderId,
      description: description.trim(),
      amount:      parseCurrency(amountDisplay),
      cost_type:   costType as MaintenanceCostType,
      receipt_url: receiptUrl,
    })
    handleClose(false)
  }

  function handleClose(val: boolean) {
    if (!val) {
      setAmountDisplay('0,00')
      setCostType('')
      setDescription('')
      setReceiptFile(null)
      setUploadPct(0)
      setErrors({})
    }
    onOpenChange(val)
  }

  const isBusy = isUploading || submitCost.isPending

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Registrar Custo</SheetTitle>
        </SheetHeader>

        <div
          className="px-4 space-y-4"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          {/* Valor */}
          <div className="space-y-1.5">
            <Label>Valor *</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium pointer-events-none select-none text-base">
                R$
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={amountDisplay}
                onChange={handleAmountChange}
                className={`w-full h-12 pl-10 pr-3 rounded-lg border text-xl font-semibold bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition ${errors.amount ? 'border-destructive' : 'border-input'}`}
                placeholder="0,00"
              />
            </div>
            {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
          </div>

          {/* Tipo */}
          <div className="space-y-1.5">
            <Label>Tipo *</Label>
            <Select
              value={costType || '__none__'}
              onValueChange={(v) => { setCostType(v === '__none__' ? '' : v as MaintenanceCostType); if (errors.type) setErrors((p) => ({ ...p, type: '' })) }}
            >
              <SelectTrigger className={`h-12 text-base ${errors.type ? 'border-destructive' : ''}`}>
                <SelectValue placeholder="Selecionar tipo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Selecionar tipo...</SelectItem>
                {(Object.entries(COST_TYPE_LABELS) as [MaintenanceCostType, string][]).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type && <p className="text-xs text-destructive">{errors.type}</p>}
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label>Descrição *</Label>
            <input
              type="text"
              value={description}
              onChange={(e) => { setDescription(e.target.value); if (errors.desc) setErrors((p) => ({ ...p, desc: '' })) }}
              placeholder="Ex: Compra de filtro ar-condicionado"
              className={`w-full h-12 px-3 rounded-lg border text-base bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition ${errors.desc ? 'border-destructive' : 'border-input'}`}
            />
            {errors.desc && <p className="text-xs text-destructive">{errors.desc}</p>}
          </div>

          {/* Comprovante via câmera */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            {receiptFile ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-3">
                {receiptFile.type.startsWith('image/') ? (
                  <ImageIcon className="w-4 h-4 text-primary shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                )}
                <span className="text-sm flex-1 truncate">{receiptFile.name}</span>
                <button
                  type="button"
                  onClick={() => { setReceiptFile(null); if (fileRef.current) fileRef.current.value = '' }}
                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full h-12 flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 hover:bg-muted/40 hover:border-primary/50 transition-colors text-sm text-muted-foreground"
              >
                <Camera className="w-4 h-4" />
                Tirar foto do comprovante
              </button>
            )}

            {/* Upload progress */}
            {isUploading && (
              <div className="mt-2 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Enviando...</span>
                  <span>{uploadPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${uploadPct}%` }} />
                </div>
              </div>
            )}
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={isBusy}
            size="lg"
            className="w-full"
          >
            {isBusy && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            {isBusy ? 'Enviando...' : 'Registrar Custo'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
