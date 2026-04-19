'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select'
import { useCreateCommercialTask } from '@/hooks/commercial-checklist/use-commercial-tasks'
import { useAuth } from '@/hooks/use-auth'
import { useUnitStore } from '@/stores/unit-store'
import { toast } from 'sonner'

interface NewTaskModalProps {
  open:    boolean
  onClose: () => void
}

export function NewTaskModal({ open, onClose }: NewTaskModalProps) {
  const { profile } = useAuth()
  const activeUnitId = useUnitStore((s) => s.activeUnitId)
  const createTask   = useCreateCommercialTask()

  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [priority,    setPriority]    = useState<'low' | 'medium' | 'high'>('medium')
  const [dueDate,     setDueDate]     = useState('')

  function reset() {
    setTitle('')
    setDescription('')
    setPriority('medium')
    setDueDate('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleSave() {
    if (!title.trim() || !profile?.id || !activeUnitId) return

    createTask.mutate(
      {
        title:       title.trim(),
        description: description.trim() || undefined,
        priority,
        due_date:    dueDate ? new Date(dueDate).toISOString() : null,
        unit_id:     activeUnitId,
        assignee_id: profile.id,
      },
      {
        onSuccess: () => {
          toast.success('Tarefa criada!')
          handleClose()
        },
        onError: () => toast.error('Erro ao criar tarefa. Tente novamente.'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Título *</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Ligar para cliente após proposta"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Descrição</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalhes adicionais..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Prioridade</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as 'low' | 'medium' | 'high')}
              >
                <SelectTrigger>
                  <span data-slot="select-value">
                    {priority === 'low' ? 'Baixa' : priority === 'medium' ? 'Média' : 'Alta'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="task-due">Prazo</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={createTask.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={createTask.isPending || !title.trim()}
          >
            {createTask.isPending ? 'Criando...' : 'Criar tarefa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
