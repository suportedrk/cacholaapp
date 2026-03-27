'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/shared/page-header'
import { SortableTemplateItems, type TemplateItemDraft } from '@/components/features/checklists/sortable-template-items'
import { useChecklistTemplate, useUpdateTemplate, useChecklistCategories } from '@/hooks/use-checklists'

export default function EditarTemplatePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data: template, isLoading, isError } = useChecklistTemplate(id)
  const updateTemplate = useUpdateTemplate()
  const { data: categories = [] } = useChecklistCategories()

  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [items, setItems] = useState<TemplateItemDraft[]>([])
  const [initialized, setInitialized] = useState(false)

  // Preencher formulário quando o template carregar
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (template && !initialized) {
      setTitle(template.title)
      setCategoryId(template.category_id ?? '')
      setItems(
        template.template_items.map((item) => ({
          tempId: item.id,
          description: item.description,
        }))
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
      title: title.trim(),
      categoryId: categoryId || null,
      isActive: template?.is_active ?? true,
      items: items
        .filter((i) => i.description.trim())
        .map((i, idx) => ({ description: i.description.trim(), sort_order: idx })),
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
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
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
      <div className="flex items-center gap-3">
        <Link
          href="/checklists/templates"
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Voltar"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <PageHeader
          title="Editar Template"
          description={template.title}
        />
      </div>

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

        {/* Categoria */}
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

        {/* Status */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="tpl-active"
            checked={true}
            disabled
            className="rounded border-border"
          />
          <Label htmlFor="tpl-active" className="text-sm font-normal text-muted-foreground cursor-default">
            Template ativo
          </Label>
        </div>
      </div>

      {/* Itens */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Itens do Template
        </h3>
        <SortableTemplateItems
          items={items}
          onChange={setItems}
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
