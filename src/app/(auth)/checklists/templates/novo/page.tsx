'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/page-header'
import { SortableTemplateItems, type TemplateItemDraft } from '@/components/features/checklists/sortable-template-items'
import { useCreateTemplate, useChecklistCategories } from '@/hooks/use-checklists'

export default function NovoTemplatePage() {
  const router = useRouter()
  const createTemplate = useCreateTemplate()
  const { data: categories = [] } = useChecklistCategories()

  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [items, setItems] = useState<TemplateItemDraft[]>([])

  const isValid = title.trim().length > 0

  async function handleSave() {
    if (!isValid) return
    await createTemplate.mutateAsync({
      title: title.trim(),
      categoryId: categoryId || undefined,
      items: items
        .filter((i) => i.description.trim())
        .map((i, idx) => ({ description: i.description.trim(), sort_order: idx })),
    })
    router.push('/checklists/templates')
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
          title="Novo Template"
          description="Crie um modelo reutilizável para seus checklists"
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
            autoFocus
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
      </div>

      {/* Itens */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Itens do Template
        </h3>
        <SortableTemplateItems
          items={items}
          onChange={setItems}
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
          disabled={!isValid || createTemplate.isPending}
        >
          {createTemplate.isPending ? 'Salvando...' : 'Salvar Template'}
        </Button>
      </div>
    </div>
  )
}
