'use client'

import { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency, parseCurrency } from '@/lib/utils/providers'
import { PRICE_TYPE_LABELS } from '@/types/providers'
import type { PriceType, ServiceCategory } from '@/types/providers'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ServiceDraft {
  category_id: string
  price_type: PriceType
  price_value: string   // formatted string e.g. "R$ 1.500,00"
  description: string
  notes: string
}

interface Props {
  initialData?: ServiceDraft
  categories: ServiceCategory[]
  usedCategoryIds: string[]   // filter already-added categories (except this one in edit)
  onSubmit: (data: ServiceDraft) => void
  onCancel: () => void
}

const DEFAULT_DRAFT: ServiceDraft = {
  category_id: '',
  price_type: 'per_event',
  price_value: '',
  description: '',
  notes: '',
}

// ─────────────────────────────────────────────────────────────
// Currency input helpers
// ─────────────────────────────────────────────────────────────

function formatInputCurrency(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return ''
  const num = parseInt(digits, 10) / 100
  return formatCurrency(num)
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function ServiceInlineForm({
  initialData,
  categories,
  usedCategoryIds,
  onSubmit,
  onCancel,
}: Props) {
  const [draft, setDraft] = useState<ServiceDraft>(initialData ?? DEFAULT_DRAFT)
  const [errors, setErrors] = useState<Partial<Record<keyof ServiceDraft, string>>>({})

  useEffect(() => {
    setDraft(initialData ?? DEFAULT_DRAFT)
    setErrors({})
  }, [initialData])

  function set<K extends keyof ServiceDraft>(field: K, value: ServiceDraft[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function handlePriceInput(raw: string) {
    set('price_value', formatInputCurrency(raw))
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof ServiceDraft, string>> = {}
    if (!draft.category_id) errs.category_id = 'Selecione uma categoria.'
    if (!draft.price_type) errs.price_type = 'Selecione o tipo de preço.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    onSubmit(draft)
  }

  // Available categories = all - already used (except the one being edited)
  const editingCatId = initialData?.category_id
  const availableCategories = categories.filter(
    (c) => c.is_active && (c.id === editingCatId || !usedCategoryIds.includes(c.id))
  )

  const inputBase = cn(
    'w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground',
    'placeholder:text-muted-foreground/60 outline-none',
    'focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors',
  )

  return (
    <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-4 space-y-4 animate-fade-up">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {initialData ? 'Editar serviço' : 'Novo serviço'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Categoria */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Categoria <span className="text-destructive">*</span>
          </label>
          <select
            value={draft.category_id}
            onChange={(e) => set('category_id', e.target.value)}
            aria-invalid={!!errors.category_id}
            className={cn(
              inputBase, 'cursor-pointer appearance-none pr-8',
              errors.category_id && 'border-destructive focus:ring-destructive/30',
            )}
          >
            <option value="">Selecione...</option>
            {availableCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon} {cat.name}
              </option>
            ))}
          </select>
          {errors.category_id && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {errors.category_id}
            </p>
          )}
        </div>

        {/* Tipo de preço */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Tipo de Preço <span className="text-destructive">*</span>
          </label>
          <select
            value={draft.price_type}
            onChange={(e) => set('price_type', e.target.value as PriceType)}
            className={cn(inputBase, 'cursor-pointer appearance-none pr-8')}
          >
            {(Object.keys(PRICE_TYPE_LABELS) as PriceType[]).map((t) => (
              <option key={t} value={t}>{PRICE_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Valor */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Valor de Referência
            <span className="text-xs text-muted-foreground font-normal ml-1">(opcional)</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={draft.price_value}
            onChange={(e) => handlePriceInput(e.target.value)}
            placeholder="R$ 0,00"
            className={inputBase}
          />
          {draft.price_type === 'per_hour' && draft.price_value && (
            <p className="text-xs text-muted-foreground">
              Valor por hora: {draft.price_value}
            </p>
          )}
        </div>

        {/* Descrição */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Descrição
            <span className="text-xs text-muted-foreground font-normal ml-1">(opcional)</span>
          </label>
          <input
            type="text"
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Ex: Equipamento próprio incluso"
            className={inputBase}
          />
        </div>
      </div>

      {/* Observações */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-foreground">
          Observações
          <span className="text-xs text-muted-foreground font-normal ml-1">(opcional)</span>
        </label>
        <input
          type="text"
          value={draft.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Informações adicionais..."
          className={inputBase}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="h-9 px-4 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {initialData ? 'Salvar' : 'Adicionar'}
        </button>
      </div>
    </div>
  )
}

// Re-export helper for parent components
export { parseCurrency }
