'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select'
import { useApplyCommercialTemplate } from '@/hooks/commercial-checklist/use-apply-template'
import { useCommercialChecklistAssignees } from '@/hooks/commercial-checklist/use-commercial-tasks'
import type { CommercialTemplate } from '@/hooks/commercial-checklist/use-commercial-templates'
import { toast } from 'sonner'

interface ApplyTemplateDialogProps {
  template: CommercialTemplate | null
  onClose:  () => void
}

export function ApplyTemplateDialog({ template, onClose }: ApplyTemplateDialogProps) {
  const applyMut  = useApplyCommercialTemplate()
  const { data: assignees, isLoading: assigneesLoading } =
    useCommercialChecklistAssignees(template?.unit_id)

  const [assigneeId, setAssigneeId] = useState('')
  const [baseDate,   setBaseDate]   = useState(
    () => new Date().toISOString().split('T')[0]
  )

  function handleClose() {
    setAssigneeId('')
    onClose()
  }

  function handleApply() {
    if (!template || !assigneeId || !baseDate) return

    applyMut.mutate(
      { templateId: template.id, assigneeId, baseDate },
      {
        onSuccess: (count) => {
          toast.success(`${count} tarefa${count !== 1 ? 's' : ''} criada${count !== 1 ? 's' : ''}!`)
          handleClose()
        },
        onError: (err: unknown) => {
          const message = (err as { message?: string })?.message
          if (message?.includes('access denied')) {
            toast.error('Sem permissão para aplicar este template.')
          } else if (message?.includes('assignee not found')) {
            toast.error('Vendedora não encontrada.')
          } else {
            toast.error('Erro ao aplicar template. Tente novamente.')
          }
        },
      }
    )
  }

  return (
    <Dialog open={!!template} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aplicar template</DialogTitle>
        </DialogHeader>

        {template && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-text-secondary">
              Template: <span className="font-medium text-text-primary">{template.title}</span>
              {template.unit_name
                ? <> · <span className="text-text-tertiary">{template.unit_name}</span></>
                : <> · <span className="text-text-tertiary">Global</span></>}
            </p>

            {/* Vendedora */}
            <div className="space-y-1.5">
              <Label>Atribuir para *</Label>
              {assigneesLoading ? (
                <div className="h-10 rounded-md bg-surface-secondary animate-pulse" />
              ) : assignees && assignees.length > 0 ? (
                <Select value={assigneeId} onValueChange={(v) => setAssigneeId(v ?? '')}>
                  <SelectTrigger>
                    <span data-slot="select-value">
                      {assigneeId
                        ? (assignees.find((a) => a.id === assigneeId)?.name ?? 'Selecionar')
                        : 'Selecionar vendedora'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {assignees.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-text-tertiary py-2">
                  Nenhuma vendedora disponível para esta unidade.
                </p>
              )}
            </div>

            {/* Data base */}
            <div className="space-y-1.5">
              <Label htmlFor="apply-base-date">Data base *</Label>
              <Input
                id="apply-base-date"
                type="date"
                value={baseDate}
                onChange={(e) => setBaseDate(e.target.value)}
              />
              <p className="text-xs text-text-tertiary">
                Os prazos de cada item serão calculados a partir desta data.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={applyMut.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleApply}
            disabled={applyMut.isPending || !assigneeId || !baseDate}
          >
            {applyMut.isPending ? 'Aplicando...' : 'Aplicar template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
