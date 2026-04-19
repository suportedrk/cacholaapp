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
import { Switch } from '@/components/ui/switch'
import {
  useCreateCommercialTemplate,
  useUpdateCommercialTemplate,
  type CommercialTemplate,
  type CommercialTemplateFormInput,
} from '@/hooks/commercial-checklist/use-commercial-templates'
import { useUnits } from '@/hooks/use-units'
import { toast } from 'sonner'

interface TemplateFormProps {
  template?: CommercialTemplate | null
  open:      boolean
  onClose:   () => void
}

// Inner form — remounts via key={template?.id ?? 'new'} on the parent,
// so initial state can be derived directly from template prop.
export function TemplateForm({ template, open, onClose }: TemplateFormProps) {
  const isEditing   = !!template
  const createMut   = useCreateCommercialTemplate()
  const updateMut   = useUpdateCommercialTemplate()
  const { data: units } = useUnits()

  const [title,          setTitle]          = useState(template?.title ?? '')
  const [description,    setDescription]    = useState(template?.description ?? '')
  const [unitId,         setUnitId]         = useState<string>(template?.unit_id ?? 'global')
  const [defaultPrio,    setDefaultPrio]    = useState<'low' | 'medium' | 'high'>(template?.default_priority ?? 'medium')
  const [defaultDueDays, setDefaultDueDays] = useState<string>(
    template?.default_due_in_days != null ? String(template.default_due_in_days) : ''
  )
  const [active, setActive] = useState(template?.active ?? true)

  function buildInput(): CommercialTemplateFormInput {
    return {
      title:               title.trim(),
      description:         description.trim() || undefined,
      unit_id:             unitId === 'global' ? null : unitId,
      default_priority:    defaultPrio,
      default_due_in_days: defaultDueDays ? parseInt(defaultDueDays, 10) : null,
      active,
    }
  }

  function handleSave() {
    if (!title.trim()) return

    if (isEditing && template) {
      updateMut.mutate(
        { id: template.id, ...buildInput() },
        {
          onSuccess: () => { toast.success('Template atualizado!'); onClose() },
          onError:   () => toast.error('Erro ao atualizar template.'),
        }
      )
    } else {
      createMut.mutate(buildInput(), {
        onSuccess: () => { toast.success('Template criado!'); onClose() },
        onError:   () => toast.error('Erro ao criar template.'),
      })
    }
  }

  const isPending = createMut.isPending || updateMut.isPending

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar template' : 'Novo template'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-title">Título *</Label>
            <Input
              id="tpl-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Pós-proposta inicial"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tpl-desc">Descrição</Label>
            <Textarea
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva quando usar este template..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Unidade */}
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Select value={unitId} onValueChange={(v) => setUnitId(v ?? 'global')}>
                <SelectTrigger>
                  <span data-slot="select-value">
                    {unitId === 'global'
                      ? 'Global (todas)'
                      : (units?.find((u) => u.id === unitId)?.name ?? 'Selecionar')}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (todas as unidades)</SelectItem>
                  {units?.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Prioridade default */}
            <div className="space-y-1.5">
              <Label>Prioridade padrão</Label>
              <Select
                value={defaultPrio}
                onValueChange={(v) => setDefaultPrio(v as 'low' | 'medium' | 'high')}
              >
                <SelectTrigger>
                  <span data-slot="select-value">
                    {defaultPrio === 'low' ? 'Baixa' : defaultPrio === 'medium' ? 'Média' : 'Alta'}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Prazo default */}
            <div className="space-y-1.5">
              <Label htmlFor="tpl-due">Prazo padrão (dias)</Label>
              <Input
                id="tpl-due"
                type="number"
                min={1}
                value={defaultDueDays}
                onChange={(e) => setDefaultDueDays(e.target.value)}
                placeholder="Ex: 3"
              />
            </div>

            {/* Ativo */}
            {isEditing && (
              <div className="space-y-1.5">
                <Label>Status</Label>
                <div className="flex items-center gap-2 h-10">
                  <Switch checked={active} onCheckedChange={setActive} />
                  <span className="text-sm text-text-secondary">{active ? 'Ativo' : 'Inativo'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isPending || !title.trim()}>
            {isPending ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
