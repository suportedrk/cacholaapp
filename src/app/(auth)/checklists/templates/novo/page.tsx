'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Clock } from 'lucide-react'
import { useIsReadOnly } from '@/hooks/use-read-only'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/page-header'
import { SortableTemplateItems, type TemplateItemDraft } from '@/components/features/checklists/sortable-template-items'
import { useCreateTemplate, useChecklistCategories } from '@/hooks/use-checklists'
import { useUsers } from '@/hooks/use-users'
import { useAuth } from '@/hooks/use-auth'
import { PRIORITY_LABELS } from '@/types/database.types'
import type { Priority } from '@/types/database.types'

function fmtMin(m: number) {
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${r}min` : `${h}h`
}

export default function NovoTemplatePage() {
  const router = useRouter()
  const { profile } = useAuth()
  const createTemplate = useCreateTemplate()
  const isReadOnly = useIsReadOnly()
  const { data: categories = [] } = useChecklistCategories()
  const { data: users = [] } = useUsers()

  const [title,           setTitle]           = useState('')
  const [categoryId,      setCategoryId]      = useState('')
  const [description,     setDescription]     = useState('')
  const [defaultPriority, setDefaultPriority] = useState<Priority>('medium')
  const [items,           setItems]           = useState<TemplateItemDraft[]>([])

  const totalMinutes = useMemo(
    () => items.reduce((s, i) => s + (i.defaultEstimatedMinutes ?? 0), 0),
    [items],
  )

  const userOptions = users
    .filter((u) => u.is_active)
    .map((u) => ({ id: u.id, name: u.name }))

  const isValid = title.trim().length > 0

  async function handleSave() {
    if (!isValid) return
    await createTemplate.mutateAsync({
      title:                    title.trim(),
      categoryId:               categoryId || null,
      createdBy:                profile?.id ?? '',
      description:              description.trim() || undefined,
      defaultPriority,
      estimatedDurationMinutes: totalMinutes || undefined,
      items: items
        .filter((i) => i.description.trim())
        .map((i, idx) => ({
          description:             i.description.trim(),
          sort_order:              idx,
          defaultPriority:         i.defaultPriority,
          defaultEstimatedMinutes: i.defaultEstimatedMinutes ?? undefined,
          notesTemplate:           i.notesTemplate ?? undefined,
          requiresPhoto:           i.requiresPhoto,
          isRequired:              i.isRequired,
        })),
    })
    router.push('/checklists/templates')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Novo Template"
        description="Crie um modelo reutilizável para seus checklists"
      />

      {/* Dados do Template */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        {/* Título */}
        <div className="space-y-1.5">
          <Label htmlFor="tpl-title">Nome do Template <span className="text-destructive">*</span></Label>
          <Input
            id="tpl-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Checklist de Decoração"
            className="h-9"
            autoFocus
          />
        </div>

        {/* Descrição */}
        <div className="space-y-1.5">
          <Label htmlFor="tpl-desc">Descrição</Label>
          <textarea
            id="tpl-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva quando e como usar este template..."
            rows={2}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* Categoria + Prioridade padrão */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {categories.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="tpl-category">Categoria</Label>
              <select
                id="tpl-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Sem categoria</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="tpl-priority">Prioridade padrão</Label>
            <select
              id="tpl-priority"
              value={defaultPriority}
              onChange={(e) => setDefaultPriority(e.target.value as Priority)}
              className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {(Object.keys(PRIORITY_LABELS) as Priority[]).map((p) => (
                <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Itens */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Itens do Template
          </h3>
          {totalMinutes > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              Total: ~{fmtMin(totalMinutes)}
            </span>
          )}
        </div>
        <SortableTemplateItems
          items={items}
          onChange={setItems}
          users={userOptions}
          disabled={createTemplate.isPending}
        />
      </div>

      {/* Ações */}
      <div className="flex items-center justify-end gap-2 pb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/checklists/templates')}
          disabled={createTemplate.isPending}
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!isValid || createTemplate.isPending || isReadOnly}
        >
          {createTemplate.isPending ? 'Salvando...' : 'Salvar Template'}
        </Button>
      </div>
    </div>
  )
}
