'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useRejectCost, formatBRL } from '@/hooks/use-maintenance-costs'

interface RejectCostModalProps {
  open:          boolean
  onOpenChange:  (open: boolean) => void
  costId:        string
  amount:        number
  description:   string
}

export function RejectCostModal({
  open,
  onOpenChange,
  costId,
  amount,
  description,
}: RejectCostModalProps) {
  const [reason, setReason] = useState('')
  const rejectCost = useRejectCost()

  const isValid  = reason.trim().length >= 10
  const charCount = reason.trim().length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid) return
    await rejectCost.mutateAsync({ costId, review_notes: reason.trim() })
    setReason('')
    onOpenChange(false)
  }

  function handleClose(val: boolean) {
    if (!val) setReason('')
    onOpenChange(val)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reprovar custo</DialogTitle>
          <DialogDescription>
            {description} — <strong>{formatBRL(amount)}</strong>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="reject-reason">
              Motivo da reprovação <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva o motivo da reprovação (mínimo 10 caracteres)..."
              className="min-h-[80px] resize-none"
              autoFocus
            />
            <p className={`text-xs ${charCount < 10 ? 'text-muted-foreground' : 'text-green-600 dark:text-green-400'}`}>
              {charCount}/10 caracteres mínimos
            </p>
          </div>

          <DialogFooter className="-mx-4 -mb-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={rejectCost.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!isValid || rejectCost.isPending}
            >
              {rejectCost.isPending ? 'Reprovando...' : 'Reprovar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
