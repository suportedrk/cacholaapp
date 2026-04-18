'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useReopenRecompraContact } from '@/hooks/use-recompra'
import { toast } from 'sonner'

interface RecompraReopenDialogProps {
  logId:   string | null
  onClose: () => void
}

export function RecompraReopenDialog({ logId, onClose }: RecompraReopenDialogProps) {
  const reopen = useReopenRecompraContact()

  function handleConfirm() {
    if (!logId) return
    reopen.mutate(logId, {
      onSuccess: () => {
        toast.success('Oportunidade de recompra reaberta.')
        onClose()
      },
      onError: (err) => {
        toast.error('Erro ao reabrir: ' + (err as Error).message)
      },
    })
  }

  return (
    <Dialog open={!!logId} onOpenChange={(open: boolean) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Reabrir oportunidade?</DialogTitle>
          <DialogDescription>
            O contato anterior será marcado como reaberto e esta oportunidade voltará à fila
            para um novo registro.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={reopen.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={reopen.isPending}>
            {reopen.isPending ? 'Reabrindo…' : 'Reabrir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
