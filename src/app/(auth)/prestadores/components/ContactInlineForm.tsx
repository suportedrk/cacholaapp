'use client'

import { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPhone } from '@/lib/utils/providers'
import { CONTACT_TYPE_LABELS } from '@/types/providers'
import type { ContactType } from '@/types/providers'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ContactDraft {
  type: ContactType
  value: string
  label: string
  is_primary: boolean
}

interface Props {
  initialData?: ContactDraft
  onSubmit: (data: ContactDraft) => void
  onCancel: () => void
}

const DEFAULT_DRAFT: ContactDraft = {
  type: 'phone',
  value: '',
  label: '',
  is_primary: false,
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function validateContactValue(type: ContactType, value: string): string | null {
  const digits = value.replace(/\D/g, '')
  if (!value.trim()) return 'Informe o contato.'
  if ((type === 'phone' || type === 'whatsapp') && digits.length < 10) {
    return 'Número inválido. Mínimo 10 dígitos.'
  }
  if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    return 'E-mail inválido.'
  }
  return null
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function ContactInlineForm({ initialData, onSubmit, onCancel }: Props) {
  const [draft, setDraft] = useState<ContactDraft>(initialData ?? DEFAULT_DRAFT)
  const [errors, setErrors] = useState<Partial<Record<keyof ContactDraft, string>>>({})

  // Reset form when initialData changes (edit mode — legitimate derived state pattern)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(initialData ?? DEFAULT_DRAFT)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setErrors({})
  }, [initialData])

  function set<K extends keyof ContactDraft>(field: K, value: ContactDraft[K]) {
    setDraft((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function handleTypeChange(type: ContactType) {
    setDraft((prev) => ({ ...prev, type, value: '' }))
    setErrors({})
  }

  function handleValueChange(raw: string) {
    if (draft.type === 'phone' || draft.type === 'whatsapp') {
      set('value', formatPhone(raw))
    } else {
      set('value', raw)
    }
  }

  function handleSubmit() {
    const valueErr = validateContactValue(draft.type, draft.value)
    if (valueErr) {
      setErrors({ value: valueErr })
      return
    }
    onSubmit(draft)
  }

  const inputBase = cn(
    'w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground',
    'placeholder:text-muted-foreground/60 outline-none',
    'focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors',
  )

  return (
    <div className="rounded-xl border-2 border-dashed border-border bg-muted/30 p-4 space-y-4 animate-fade-up">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {initialData ? 'Editar contato' : 'Novo contato'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Tipo */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Tipo <span className="text-destructive">*</span>
          </label>
          <select
            value={draft.type}
            onChange={(e) => handleTypeChange(e.target.value as ContactType)}
            className={cn(inputBase, 'cursor-pointer appearance-none pr-8')}
          >
            {(Object.keys(CONTACT_TYPE_LABELS) as ContactType[]).map((t) => (
              <option key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        {/* Valor */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            {draft.type === 'email' ? 'E-mail' : 'Número'} <span className="text-destructive">*</span>
          </label>
          <input
            type={draft.type === 'email' ? 'email' : 'tel'}
            value={draft.value}
            onChange={(e) => handleValueChange(e.target.value)}
            onBlur={() => {
              const err = validateContactValue(draft.type, draft.value)
              if (err) setErrors((p) => ({ ...p, value: err }))
            }}
            placeholder={
              draft.type === 'email' ? 'email@exemplo.com' : '(11) 99999-0000'
            }
            aria-invalid={!!errors.value}
            className={cn(inputBase, errors.value && 'border-destructive focus:ring-destructive/30')}
          />
          {errors.value && (
            <p className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="w-3 h-3 shrink-0" />
              {errors.value}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Rótulo */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Rótulo <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={draft.label}
            onChange={(e) => set('label', e.target.value)}
            placeholder="Ex: Comercial, Financeiro..."
            className={inputBase}
          />
        </div>

        {/* Contato principal */}
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={draft.is_primary}
              onChange={(e) => set('is_primary', e.target.checked)}
              className="h-4 w-4 rounded border-input accent-primary cursor-pointer"
            />
            <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors select-none">
              Contato principal
            </span>
          </label>
        </div>
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
