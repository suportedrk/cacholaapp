'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCompleteCommercialTask, type CommercialTask } from '@/hooks/commercial-checklist/use-commercial-tasks'
import { toast } from 'sonner'

interface TaskCompleteDialogProps {
  task:    CommercialTask | null
  onClose: () => void
}

export function TaskCompleteDialog({ task, onClose }: TaskCompleteDialogProps) {
  const complete = useCompleteCommercialTask()
  const [notes, setNotes] = useState('')

  function handleConfirm() {
    if (!task) return
    complete.mutate(
      { id: task.id, notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Tarefa concluída!')
          setNotes('')
          onClose()
        },
        onError: () => toast.error('Erro ao concluir tarefa. Tente novamente.'),
      }
    )
  }

  return (
    <Dialog open={!!task} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Concluir tarefa</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-text-secondary">
            <span className="font-medium text-text-primary">{task?.title}</span>
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="completion-notes">Observação (opcional)</Label>
            <Textarea
              id="completion-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Descreva o resultado ou comentários..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={complete.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={complete.isPending}>
            {complete.isPending ? 'Salvando...' : 'Confirmar conclusão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
