'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Play, Pencil, ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'
import { hasRole, COMMERCIAL_CHECKLIST_MANAGE_ROLES } from '@/config/roles'
import {
  useCommercialTemplate,
} from '@/hooks/commercial-checklist/use-commercial-templates'
import {
  useCommercialTemplateItems,
  useCreateCommercialTemplateItem,
  useUpdateCommercialTemplateItem,
  useDeleteCommercialTemplateItem,
  useReorderCommercialTemplateItems,
} from '@/hooks/commercial-checklist/use-commercial-template-items'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { TemplateForm } from '../../_components/template-form'
import {
  TemplateItemList,
  existingItemsToDrafts,
  type TemplateItemDraft,
} from '../../_components/template-item-row'
import { ApplyTemplateDialog } from '../../_components/apply-template-dialog'
import { toast } from 'sonner'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function EditTemplatePage({ params }: PageProps) {
  const { id } = use(params)
  const { profile } = useAuth()

  if (!hasRole(profile?.role, COMMERCIAL_CHECKLIST_MANAGE_ROLES)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-text-secondary">Sem permissão para acessar esta página.</p>
      </div>
    )
  }

  return <EditTemplateContent id={id} />
}

function EditTemplateContent({ id }: { id: string }) {
  const router   = useRouter()
  const [editOpen,  setEditOpen]  = useState(false)
  const [applyOpen, setApplyOpen] = useState(false)

  const { data: template, isLoading: tplLoading, isError: tplError, refetch } =
    useCommercialTemplate(id)
  const { data: existingItems, isLoading: itemsLoading } =
    useCommercialTemplateItems(id)
  const { isTimedOut, retry } = useLoadingTimeout(tplLoading || itemsLoading)

  const createItem  = useCreateCommercialTemplateItem()
  const updateItem  = useUpdateCommercialTemplateItem()
  const deleteItem  = useDeleteCommercialTemplateItem()
  const reorderItem = useReorderCommercialTemplateItems()

  // editedDrafts tracks user edits; null = show server data (no edits yet)
  const [editedDrafts, setEditedDrafts] = useState<TemplateItemDraft[] | null>(null)
  const dirty = editedDrafts !== null

  // Display: user edits if dirty, otherwise server data
  const drafts = editedDrafts ?? existingItemsToDrafts(existingItems ?? [])

  function handleDraftsChange(updated: TemplateItemDraft[]) {
    setEditedDrafts(updated)
  }

  async function handleSaveItems() {
    if (!editedDrafts) return

    const existingIds = (existingItems ?? []).map((i) => i.id)
    const draftIds    = editedDrafts.filter((d) => existingIds.includes(d.tempId)).map((d) => d.tempId)

    // Delete removed items
    for (const item of (existingItems ?? [])) {
      if (!draftIds.includes(item.id)) {
        await deleteItem.mutateAsync({ id: item.id, templateId: id })
      }
    }

    // Create or update
    for (let i = 0; i < drafts.length; i++) {
      const draft = drafts[i]
      if (!draft.title.trim()) continue

      const payload = {
        title:       draft.title.trim(),
        description: draft.description.trim() || undefined,
        priority:    draft.priority,
        due_in_days: draft.due_in_days ? parseInt(draft.due_in_days, 10) : null,
        sort_order:  i,
      }

      if (existingIds.includes(draft.tempId)) {
        await updateItem.mutateAsync({ id: draft.tempId, templateId: id, ...payload })
      } else {
        await createItem.mutateAsync({ templateId: id, ...payload })
      }
    }

    toast.success('Itens salvos!')
    setEditedDrafts(null)  // reset to server state
  }

  const isSaving = createItem.isPending || updateItem.isPending ||
                   deleteItem.isPending || reorderItem.isPending

  if (tplLoading && !isTimedOut) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded skeleton-shimmer" />
        <div className="h-24 rounded-lg skeleton-shimmer" />
      </div>
    )
  }

  if (tplError || isTimedOut) {
    return (
      <div className="rounded-lg border border-status-error-bg bg-status-error-bg/40 p-4 flex items-center justify-between">
        <p className="text-sm text-status-error-text">Erro ao carregar template.</p>
        <Button variant="outline" size="sm" onClick={() => { retry(); refetch() }}>
          Tentar novamente
        </Button>
      </div>
    )
  }

  if (!template) return null

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push('/vendas/checklist/templates')}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Templates
        </Button>
      </div>

      {/* Template card */}
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-semibold text-text-primary">{template.title}</h1>
              {!template.active && (
                <span className="badge-gray border text-xs rounded-full px-2 py-0.5">Inativo</span>
              )}
              <span className="badge-brand border text-xs rounded-full px-2 py-0.5">
                {template.unit_name ?? 'Global'}
              </span>
            </div>
            {template.description && (
              <p className="text-sm text-text-secondary mt-1">{template.description}</p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-text-tertiary">
              {template.default_due_in_days != null && (
                <span>Prazo padrão: {template.default_due_in_days} dia{template.default_due_in_days !== 1 ? 's' : ''}</span>
              )}
              <span>Prioridade padrão: {
                template.default_priority === 'low' ? 'Baixa'
                : template.default_priority === 'medium' ? 'Média'
                : 'Alta'
              }</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4 mr-1.5" />
              Editar
            </Button>
            <Button size="sm" onClick={() => setApplyOpen(true)}>
              <Play className="h-4 w-4 mr-1.5" />
              Aplicar
            </Button>
          </div>
        </div>
      </div>

      {/* Items section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Itens do template
          </h2>
          {dirty && (
            <Button size="sm" onClick={handleSaveItems} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar itens'}
            </Button>
          )}
        </div>

        {itemsLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <div key={i} className="h-12 rounded-lg skeleton-shimmer" />)}
          </div>
        ) : (
          <TemplateItemList items={drafts} onChange={handleDraftsChange} />
        )}

        {dirty && (
          <p className="text-xs text-text-tertiary">
            Alterações não salvas. Clique em &ldquo;Salvar itens&rdquo; para confirmar.
          </p>
        )}
      </div>

      {/* Dialogs */}
      <TemplateForm
        key={template.id}
        template={template}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
      <ApplyTemplateDialog
        template={applyOpen ? template : null}
        onClose={() => setApplyOpen(false)}
      />
    </div>
  )
}
