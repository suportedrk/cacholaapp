'use client'

import { useState, useRef } from 'react'
import { Upload, Loader2, X, FileText, Image } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useMaintenanceOrders } from '@/hooks/use-maintenance'
import {
  useSubmitCost, useUploadReceipt,
  COST_TYPE_LABELS, type CostInsert,
} from '@/hooks/use-maintenance-costs'
import type { MaintenanceCostType } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// CURRENCY INPUT
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
// TYPES
// ─────────────────────────────────────────────────────────────
interface FormState {
  order_id:      string
  description:   string
  amountDisplay: string
  cost_type:     MaintenanceCostType | ''
  receipt_notes: string
}

const DEFAULT_FORM: FormState = {
  order_id:      '',
  description:   '',
  amountDisplay: '0,00',
  cost_type:     '',
  receipt_notes: '',
}

interface CostFormModalProps {
  open:         boolean
  onOpenChange: (open: boolean) => void
  /** When opened from order detail, pre-select this order */
  preOrderId?:  string
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export function CostFormModal({ open, onOpenChange, preOrderId }: CostFormModalProps) {
  const [form, setForm]           = useState<FormState>(() => ({
    ...DEFAULT_FORM,
    order_id: preOrderId ?? '',
  }))
  const [errors, setErrors]       = useState<Partial<Record<keyof FormState, string>>>({})
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [uploadPct, setUploadPct] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const submitCost   = useSubmitCost()
  const uploadReceipt = useUploadReceipt()

  // Open orders for select
  const { data: ordersData } = useMaintenanceOrders({
    status: ['open', 'in_progress', 'waiting_parts'],
    page: 1, pageSize: 100,
  })
  const orders = ordersData?.data ?? []

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof FormState, string>> = {}
    if (!form.order_id)   errs.order_id   = 'Selecione uma ordem'
    if (!form.description.trim()) errs.description = 'Descrição é obrigatória'
    if (parseCurrency(form.amountDisplay) <= 0) errs.amountDisplay = 'Informe um valor válido'
    if (!form.cost_type)  errs.cost_type  = 'Selecione o tipo'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, description: 'Arquivo máximo 10MB' }))
      return
    }
    setReceiptFile(file)
  }

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const masked = maskCurrency(e.target.value)
    set('amountDisplay', masked)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    let receiptUrl: string | null = null

    // Upload receipt if selected
    if (receiptFile) {
      setIsUploading(true)
      try {
        receiptUrl = await uploadReceipt.mutateAsync({
          file: receiptFile,
          onProgress: setUploadPct,
        })
      } catch {
        setIsUploading(false)
        return
      }
      setIsUploading(false)
      setUploadPct(0)
    }

    const payload: CostInsert = {
      order_id:      form.order_id,
      description:   form.description.trim(),
      amount:        parseCurrency(form.amountDisplay),
      cost_type:     form.cost_type as MaintenanceCostType,
      receipt_url:   receiptUrl,
      receipt_notes: form.receipt_notes.trim() || null,
    }

    await submitCost.mutateAsync(payload)
    handleClose(false)
  }

  function handleClose(val: boolean) {
    if (!val) {
      setForm({ ...DEFAULT_FORM, order_id: preOrderId ?? '' })
      setErrors({})
      setReceiptFile(null)
      setUploadPct(0)
    }
    onOpenChange(val)
  }

  const isBusy = isUploading || submitCost.isPending

  const fileIcon = receiptFile
    ? receiptFile.type.startsWith('image/')
      ? <Image className="w-3.5 h-3.5 text-primary" />
      : <FileText className="w-3.5 h-3.5 text-primary" />
    : null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar Custo</DialogTitle>
          <DialogDescription>Envie o gasto para aprovação do gerente.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Ordem */}
          <div className="space-y-1.5">
            <Label>Ordem de Serviço <span className="text-destructive">*</span></Label>
            <Select
              value={form.order_id || null}
              onValueChange={(v) => set('order_id', v ?? '')}
            >
              <SelectTrigger className={errors.order_id ? 'border-destructive' : ''}>
                {form.order_id
                  ? <span data-slot="select-value" className="flex flex-1 text-left">{orders.find((o) => o.id === form.order_id)?.title ?? form.order_id}</span>
                  : <SelectValue placeholder="Selecionar ordem..." />}
              </SelectTrigger>
              <SelectContent>
                {orders.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.order_id && <p className="text-xs text-destructive">{errors.order_id}</p>}
          </div>

          {/* Descrição */}
          <div className="space-y-1.5">
            <Label htmlFor="cost-desc">
              Descrição <span className="text-destructive">*</span>
            </Label>
            <Input
              id="cost-desc"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Ex: Compra de filtro para ar-condicionado"
              className={errors.description ? 'border-destructive' : ''}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
          </div>

          {/* Valor + Tipo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cost-amount">
                Valor <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none">
                  R$
                </span>
                <Input
                  id="cost-amount"
                  inputMode="numeric"
                  value={form.amountDisplay}
                  onChange={handleAmountChange}
                  className={`pl-9 ${errors.amountDisplay ? 'border-destructive' : ''}`}
                  placeholder="0,00"
                />
              </div>
              {errors.amountDisplay && <p className="text-xs text-destructive">{errors.amountDisplay}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Tipo <span className="text-destructive">*</span></Label>
              <Select
                value={form.cost_type || null}
                onValueChange={(v) => set('cost_type', (v ?? '') as MaintenanceCostType | '')}
              >
                <SelectTrigger className={errors.cost_type ? 'border-destructive' : ''}>
                  {form.cost_type
                    ? <span data-slot="select-value" className="flex flex-1 text-left">{COST_TYPE_LABELS[form.cost_type as MaintenanceCostType]}</span>
                    : <SelectValue placeholder="Tipo..." />}
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(COST_TYPE_LABELS) as [MaintenanceCostType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.cost_type && <p className="text-xs text-destructive">{errors.cost_type}</p>}
            </div>
          </div>

          {/* Comprovante */}
          <div className="space-y-1.5">
            <Label>Comprovante</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleFileChange}
              className="hidden"
            />
            {receiptFile ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                {fileIcon}
                <span className="text-sm flex-1 truncate">{receiptFile.name}</span>
                <button
                  type="button"
                  onClick={() => { setReceiptFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 hover:bg-muted/40 hover:border-primary/50 transition-colors px-3 py-2.5 text-sm text-muted-foreground"
              >
                <Upload className="w-4 h-4" />
                Anexar comprovante (PDF, imagem, max 10MB)
              </button>
            )}
            {/* Upload progress */}
            {isUploading && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Enviando...</span>
                  <span>{uploadPct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label htmlFor="cost-notes">Observações para o gerente</Label>
            <Textarea
              id="cost-notes"
              value={form.receipt_notes}
              onChange={(e) => set('receipt_notes', e.target.value)}
              placeholder="Informações adicionais sobre o custo..."
              className="min-h-[60px] resize-none"
            />
          </div>

          <DialogFooter className="-mx-4 -mb-4">
            <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={isBusy}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isBusy}>
              {isBusy && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {isBusy ? 'Enviando...' : 'Enviar para Aprovação'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
