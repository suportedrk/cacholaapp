'use client'

import { useState, cloneElement, isValidElement, type ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void | Promise<void>
  hideCancelButton?: boolean
  // Controlled pattern
  open?: boolean
  onOpenChange?: (open: boolean) => void
  // Trigger pattern (uncontrolled)
  trigger?: ReactNode
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  loading = false,
  hideCancelButton = false,
  onConfirm,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
}: ConfirmDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)

  const isControlled = controlledOpen !== undefined
  const dialogOpen = isControlled ? controlledOpen : internalOpen

  function handleOpenChange(val: boolean) {
    if (!isControlled) setInternalOpen(val)
    controlledOnOpenChange?.(val)
  }

  // Inject onClick into trigger element to open the dialog
  const triggerElement =
    trigger && isValidElement(trigger)
      ? cloneElement(trigger as React.ReactElement<{ onClick?: () => void }>, {
          onClick: () => handleOpenChange(true),
        })
      : trigger

  return (
    <>
      {triggerElement}
      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            {!hideCancelButton && (
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={loading}
              >
                {cancelLabel}
              </Button>
            )}
            <Button
              variant={destructive ? 'destructive' : 'default'}
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? 'Aguarde...' : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
