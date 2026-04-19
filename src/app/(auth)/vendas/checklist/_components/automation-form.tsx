'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  useCreateCommercialAutomation,
  useUpdateCommercialAutomation,
  type CommercialAutomation,
  type CommercialAutomationFormInput,
} from '@/hooks/commercial-checklist/use-commercial-automations'
import { usePloomeStages } from '@/hooks/commercial-checklist/use-ploomes-stages'
import { useCommercialTemplates } from '@/hooks/commercial-checklist/use-commercial-templates'
import { useUnits } from '@/hooks/use-units'
import { toast } from 'sonner'

interface AutomationFormProps {
  automation?: CommercialAutomation | null
  open:        boolean
  onClose:     () => void
}

export function AutomationForm({ automation, open, onClose }: AutomationFormProps) {
  const isEditing = !!automation
  const createMut = useCreateCommercialAutomation()
  const updateMut = useUpdateCommercialAutomation()

  const { data: stages    = [], isLoading: stagesLoading }    = usePloomeStages()
  const { data: templates = [], isLoading: templatesLoading } = useCommercialTemplates(false)
  const { data: units     = [] }                              = useUnits()

  const [stageId,     setStageId]     = useState<string>(
    automation?.stage_id != null ? String(automation.stage_id) : ''
  )
  const [templateId,  setTemplateId]  = useState<string>(automation?.template_id ?? '')
  const [unitId,      setUnitId]      = useState<string>(automation?.unit_id ?? 'global')
  const [active,      setActive]      = useState(automation?.active ?? true)

  const isPending = createMut.isPending || updateMut.isPending
  const canSave   = !!stageId && !!templateId

  async function handleSave() {
    if (!canSave) return

    const selectedStage = stages.find((s) => String(s.stage_id) === stageId)

    const input: CommercialAutomationFormInput = {
      unit_id:    unitId === 'global' ? null : unitId,
      stage_id:   Number(stageId),
      stage_name: selectedStage?.stage_name ?? null,
      template_id: templateId,
    }

    try {
      if (isEditing) {
        await updateMut.mutateAsync({ id: automation.id, ...input, active })
        toast.success('Automação atualizada!')
      } else {
        await createMut.mutateAsync(input)
        toast.success('Automação criada!')
      }
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.error(`Erro ao salvar automação: ${msg}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar automação' : 'Nova automação'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Stage */}
          <div className="space-y-1.5">
            <Label>Stage Ploomes <span className="text-status-error-text">*</span></Label>
            <Select value={stageId} onValueChange={(v) => { if (v) setStageId(v) }} disabled={stagesLoading}>
              <SelectTrigger>
                <SelectValue placeholder={stagesLoading ? 'Carregando…' : 'Selecione um stage'} />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.stage_id} value={String(s.stage_id)}>
                    {s.stage_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-text-tertiary">
              Quando um deal entrar neste stage, as tarefas do template serão criadas.
            </p>
          </div>

          {/* Template */}
          <div className="space-y-1.5">
            <Label>Template de tarefas <span className="text-status-error-text">*</span></Label>
            <Select value={templateId} onValueChange={(v) => { if (v) setTemplateId(v) }} disabled={templatesLoading}>
              <SelectTrigger>
                <SelectValue placeholder={templatesLoading ? 'Carregando…' : 'Selecione um template'} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.title}
                    {t.unit_name ? ` — ${t.unit_name}` : ' — Global'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Unidade */}
          <div className="space-y-1.5">
            <Label>Unidade</Label>
            <Select value={unitId} onValueChange={(v) => { if (v) setUnitId(v) }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global (todas as unidades)</SelectItem>
                {units.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-text-tertiary">
              &ldquo;Global&rdquo; dispara para deals de qualquer unidade.
            </p>
          </div>

          {/* Ativo (somente no edit) */}
          {isEditing && (
            <div className="flex items-center gap-3">
              <Switch id="auto-active" checked={active} onCheckedChange={setActive} />
              <Label htmlFor="auto-active" className="cursor-pointer">
                {active ? 'Ativa' : 'Inativa'}
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave || isPending}>
            {isPending ? 'Salvando…' : isEditing ? 'Salvar' : 'Criar automação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
