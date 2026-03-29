'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { SortableTemplateItems, type TemplateItemDraft } from '@/components/features/checklists/sortable-template-items'
import { useChecklistTemplate, useUpdateTemplate, useChecklistCategories } from '@/hooks/use-checklists'
import { useUsers } from '@/hooks/use-users'
import { PRIORITY_LABELS } from '@/types/database.types'
import type { Priority } from '@/types/database.types'

function fmtMin(m: number) {
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}h ${r}min` : `${h}h`
}

export default function EditarTemplatePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data: template, isLoading, isError } = useChecklistTemplate(id)
  const updateTemplate = useUpdateTemplate()
  const { data: categories = [] } = useChecklistCategories()
  const { data: users = [] } = useUsers()

  const [title,           setTitle]           = useState('')
  const [categoryId,      setCategoryId]      = useState('')
  const [description,     setDescription]     = useState('')
  const [defaultPriority, setDefaultPriority] = useState<Priority>('medium')
  const [items,           setItems]           = useState<TemplateItemDraft[]>([])
  const [initialized,     setInitialized]     = useState(false)

  const totalMinutes = useMemo(
    () => items.reduce((s, i) => s + (i.defaultEstimatedMinutes ?? 0), 0),
    [items],
  )

  const userOptions = users
    .filter((u) => u.is_active)
    .map((u) => ({ id: u.id, name: u.name }))

  // Preencher formulário quando o template carregar
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (template && !initialized) {
      setTitle(template.title)
      setCategoryId(template.category_id ?? '')
      setDescription(template.description ?? '')
      setDefaultPriority((template.default_priority as Priority) ?? 'medium')
      setItems(
        template.template_items
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((item) => {
            // default_assigned_to is JSONB { type, value } — extract userId if type==='user'
            const assignedTo = item.default_assigned_to as { type: string; value: string } | null
            return {
              tempId:                  item.id,
              description:             item.description,
              defaultPriority:         (item.default_priority as Priority) ?? 'medium',
              defaultEstimatedMinutes: item.default_estimated_minutes ?? null,
              defaultAssignedToUserId: assignedTo?.type === 'user' ? assignedTo.value : null,
              notesTemplate:           item.notes_template ?? null,
              requiresPhoto:           item.requires_photo ?? false,
              isRequired:              item.is_required ?? true,
            }
          }),
      )
      setInitialized(true)
    }
  }, [template, initialized])
  /* eslint-enable react-hooks/set-state-in-effect */

  const isValid = title.trim().length > 0

  async function handleSave() {
    if (!isValid) return
    await updateTemplate.mutateAsync({
      id,
      title:                    title.trim(),
      categoryId:               categoryId || null,
      isActive:                 template?.is_active ?? true,
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

  // ─── Loading ───
  if (isLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-3">
          <Skeleton className="w-5 h-5" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="bg-card border border-border rounded-xl p-4 space-y-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-11 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // ─── Erro ───
  if (isError || !template) {
    return (
      <div className="space-y-4">
        <Link
          href="/checklists/templates"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          Template não encontrado ou erro ao carregar.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Editar Template"
        description={template.title}
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
          disabled={updateTemplate.isPending}
        />
      </div>

      {/* Ações */}
      <div className="flex items-center justify-end gap-2 pb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/checklists/templates')}
          disabled={updateTemplate.isPending}
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!isValid || updateTemplate.isPending}
        >
          {updateTemplate.isPending ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>
    </div>
  )
}
