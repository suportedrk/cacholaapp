'use client'

import { useState } from 'react'
import { Pencil, Trash2, Plus, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils/providers'
import { PRICE_TYPE_LABELS } from '@/types/providers'
import { ServiceInlineForm, parseCurrency } from '../ServiceInlineForm'
import type { ServiceDraft } from '../ServiceInlineForm'
import type { ProviderService, ServiceCategory } from '@/types/providers'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface Props {
  savedServices: ProviderService[]
  pendingServices: ServiceDraft[]
  categories: ServiceCategory[]
  errors: Record<string, string>
  onAddPending: (service: ServiceDraft) => void
  onUpdatePending: (index: number, service: ServiceDraft) => void
  onRemovePending: (index: number) => void
  onDeleteSaved?: (id: string) => void
  onUpdateSaved?: (id: string, data: Partial<ServiceDraft>) => void
}

// ─────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────

export function validateServicesStep(
  savedServices: ProviderService[],
  pendingServices: ServiceDraft[],
): Record<string, string> {
  const errs: Record<string, string> = {}
  if (savedServices.length + pendingServices.length === 0) {
    errs.services = 'Adicione pelo menos um serviço.'
  }
  return errs
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function ServicesStep({
  savedServices,
  pendingServices,
  categories,
  errors,
  onAddPending,
  onUpdatePending,
  onRemovePending,
  onDeleteSaved,
  onUpdateSaved,
}: Props) {
  const [showForm, setShowForm] = useState(false)
  const [editingPendingIdx, setEditingPendingIdx] = useState<number | null>(null)
  const [editingSavedId, setEditingSavedId] = useState<string | null>(null)

  const totalServices = savedServices.length + pendingServices.length

  // Collect category IDs already in use
  const usedSavedCatIds = savedServices.map((s) => s.category_id)
  const usedPendingCatIds = pendingServices.map((s) => s.category_id)
  const allUsedCatIds = [...usedSavedCatIds, ...usedPendingCatIds]

  function getCategoryInfo(catId: string) {
    return categories.find((c) => c.id === catId)
  }

  function handleAddSubmit(draft: ServiceDraft) {
    onAddPending(draft)
    setShowForm(false)
  }

  function handlePendingEditSubmit(draft: ServiceDraft) {
    if (editingPendingIdx === null) return
    onUpdatePending(editingPendingIdx, draft)
    setEditingPendingIdx(null)
  }

  function handleSavedEditSubmit(draft: ServiceDraft) {
    if (!editingSavedId || !onUpdateSaved) return
    onUpdateSaved(editingSavedId, draft)
    setEditingSavedId(null)
  }

  function pendingToSaved(s: ServiceDraft): Partial<ProviderService> {
    return {
      category_id: s.category_id,
      price_type: s.price_type,
      price_value: s.price_value ? parseCurrency(s.price_value) : null,
      description: s.description || null,
      notes: s.notes || null,
    }
  }

  const ServiceCard = ({
    catId,
    priceType,
    priceValue,
    description,
    onEdit,
    onDelete,
  }: {
    catId: string
    priceType: string
    priceValue: number | null
    description: string | null
    onEdit: () => void
    onDelete: () => void
  }) => {
    const cat = getCategoryInfo(catId)
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3.5">
        {/* Category badge */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
          style={{ background: cat?.color ? `${cat.color}20` : undefined }}
        >
          <span role="img" aria-label={cat?.name}>{cat?.icon ?? '🔧'}</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{cat?.name ?? 'Serviço'}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
            <span className="text-xs text-muted-foreground">
              {PRICE_TYPE_LABELS[priceType as keyof typeof PRICE_TYPE_LABELS] ?? priceType}
            </span>
            {priceValue != null && priceValue > 0 && (
              <>
                <span className="text-muted-foreground/40 text-xs">·</span>
                <span className="text-xs font-medium text-foreground">{formatCurrency(priceValue)}</span>
              </>
            )}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground/70 italic mt-0.5 truncate">&ldquo;{description}&rdquo;</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Editar serviço"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="Remover serviço"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Serviços Oferecidos</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Selecione as categorias e defina valores de referência para cada serviço.
        </p>
      </div>

      {errors.services && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/[0.07] px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{errors.services}</p>
        </div>
      )}

      {/* Saved services */}
      {savedServices.map((s) => {
        if (editingSavedId === s.id) {
          const initialDraft: ServiceDraft = {
            category_id: s.category_id,
            price_type: s.price_type,
            price_value: s.price_value ? formatCurrency(s.price_value) : '',
            description: s.description ?? '',
            notes: s.notes ?? '',
          }
          return (
            <ServiceInlineForm
              key={s.id}
              initialData={initialDraft}
              categories={categories}
              usedCategoryIds={allUsedCatIds.filter((id) => id !== s.category_id)}
              onSubmit={handleSavedEditSubmit}
              onCancel={() => setEditingSavedId(null)}
            />
          )
        }
        return (
          <ServiceCard
            key={s.id}
            catId={s.category_id}
            priceType={s.price_type}
            priceValue={s.price_value}
            description={s.description}
            onEdit={() => setEditingSavedId(s.id)}
            onDelete={() => onDeleteSaved?.(s.id)}
          />
        )
      })}

      {/* Pending services */}
      {pendingServices.map((s, idx) => {
        if (editingPendingIdx === idx) {
          return (
            <ServiceInlineForm
              key={idx}
              initialData={s}
              categories={categories}
              usedCategoryIds={allUsedCatIds.filter((id) => id !== s.category_id)}
              onSubmit={handlePendingEditSubmit}
              onCancel={() => setEditingPendingIdx(null)}
            />
          )
        }
        const parsed = s.price_value ? parseCurrency(s.price_value) : null
        return (
          <ServiceCard
            key={idx}
            catId={s.category_id}
            priceType={s.price_type}
            priceValue={parsed}
            description={s.description || null}
            onEdit={() => setEditingPendingIdx(idx)}
            onDelete={() => onRemovePending(idx)}
          />
        )
      })}

      {/* Inline form */}
      {showForm && (
        <ServiceInlineForm
          categories={categories}
          usedCategoryIds={allUsedCatIds}
          onSubmit={handleAddSubmit}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Add button */}
      {!showForm && editingPendingIdx === null && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          disabled={allUsedCatIds.length >= categories.length && categories.length > 0}
          className={cn(
            'flex items-center gap-2 h-10 px-4 rounded-lg border border-dashed border-border',
            'text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/30',
            'transition-colors w-full sm:w-auto',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <Plus className="w-4 h-4" />
          Adicionar serviço
        </button>
      )}

      {totalServices > 0 && (
        <p className="text-xs text-muted-foreground">
          {totalServices} {totalServices === 1 ? 'serviço adicionado' : 'serviços adicionados'}
        </p>
      )}
    </div>
  )
}

// Re-export for use in ProviderForm
export { pendingToSaved }

function pendingToSaved(s: ServiceDraft) {
  return {
    category_id: s.category_id,
    price_type: s.price_type,
    price_value: s.price_value ? parseCurrency(s.price_value) : undefined,
    description: s.description || undefined,
    notes: s.notes || undefined,
  }
}
