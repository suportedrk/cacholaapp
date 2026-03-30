'use client'

import { useState } from 'react'
import { Phone, Mail, MessageCircle, Star, Pencil, Trash2, Plus, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPhone } from '@/lib/utils/providers'
import { CONTACT_TYPE_LABELS } from '@/types/providers'
import { ContactInlineForm } from '../ContactInlineForm'
import type { ContactDraft } from '../ContactInlineForm'
import type { ProviderContact, ContactType } from '@/types/providers'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface Props {
  // Existing saved contacts (edit mode)
  savedContacts: ProviderContact[]
  // Pending contacts (creation mode — not yet saved)
  pendingContacts: ContactDraft[]
  errors: Record<string, string>
  onAddPending: (contact: ContactDraft) => void
  onUpdatePending: (index: number, contact: ContactDraft) => void
  onRemovePending: (index: number) => void
  // Edit mode mutations (fired immediately)
  onDeleteSaved?: (id: string) => void
  onUpdateSaved?: (id: string, data: Partial<ContactDraft>) => void
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

export function validateContactsStep(
  savedContacts: ProviderContact[],
  pendingContacts: ContactDraft[],
): Record<string, string> {
  const errs: Record<string, string> = {}
  if (savedContacts.length + pendingContacts.length === 0) {
    errs.contacts = 'Adicione pelo menos um contato.'
  }
  return errs
}

const CONTACT_ICONS: Record<ContactType, React.ElementType> = {
  phone:    Phone,
  email:    Mail,
  whatsapp: MessageCircle,
}

function formatContactValue(type: ContactType, value: string): string {
  if (type === 'phone' || type === 'whatsapp') return formatPhone(value)
  return value
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export function ContactsStep({
  savedContacts,
  pendingContacts,
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

  const totalContacts = savedContacts.length + pendingContacts.length

  function handleAddSubmit(draft: ContactDraft) {
    // If marking as primary, update any existing primary
    if (draft.is_primary) {
      pendingContacts.forEach((_, idx) => {
        if (pendingContacts[idx].is_primary) {
          onUpdatePending(idx, { ...pendingContacts[idx], is_primary: false })
        }
      })
    }
    onAddPending(draft)
    setShowForm(false)
  }

  function handlePendingEditSubmit(draft: ContactDraft) {
    if (editingPendingIdx === null) return
    onUpdatePending(editingPendingIdx, draft)
    setEditingPendingIdx(null)
  }

  function handleSavedEditSubmit(draft: ContactDraft) {
    if (!editingSavedId || !onUpdateSaved) return
    onUpdateSaved(editingSavedId, draft)
    setEditingSavedId(null)
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Contatos do Prestador</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Adicione telefones, e-mails e WhatsApp. Marque o principal para destacar.
        </p>
      </div>

      {/* Error global */}
      {errors.contacts && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/[0.07] px-3 py-2.5">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-sm text-destructive">{errors.contacts}</p>
        </div>
      )}

      {/* Saved contacts */}
      {savedContacts.map((c) => {
        const Icon = CONTACT_ICONS[c.type]
        if (editingSavedId === c.id) {
          return (
            <ContactInlineForm
              key={c.id}
              initialData={{
                type: c.type,
                value: c.value,
                label: c.label ?? '',
                is_primary: c.is_primary,
              }}
              onSubmit={handleSavedEditSubmit}
              onCancel={() => setEditingSavedId(null)}
            />
          )
        }
        return (
          <div
            key={c.id}
            className={cn(
              'flex items-start gap-3 rounded-xl border border-border bg-card p-3.5',
              c.is_primary && 'border-primary/30 bg-primary/[0.03]',
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {formatContactValue(c.type, c.value)}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {c.label && (
                  <span className="text-xs text-muted-foreground">{c.label}</span>
                )}
                <span className="text-xs text-muted-foreground">{CONTACT_TYPE_LABELS[c.type]}</span>
                {c.is_primary && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                    <Star className="w-3 h-3 fill-current" />
                    Principal
                  </span>
                )}
              </div>
            </div>
            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setEditingSavedId(c.id)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Editar contato"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              {onDeleteSaved && (
                <button
                  type="button"
                  onClick={() => onDeleteSaved(c.id)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Remover contato"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )
      })}

      {/* Pending contacts */}
      {pendingContacts.map((c, idx) => {
        const Icon = CONTACT_ICONS[c.type]
        if (editingPendingIdx === idx) {
          return (
            <ContactInlineForm
              key={idx}
              initialData={c}
              onSubmit={handlePendingEditSubmit}
              onCancel={() => setEditingPendingIdx(null)}
            />
          )
        }
        return (
          <div
            key={idx}
            className={cn(
              'flex items-start gap-3 rounded-xl border border-border bg-card p-3.5',
              c.is_primary && 'border-primary/30 bg-primary/[0.03]',
            )}
          >
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {formatContactValue(c.type, c.value)}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {c.label && (
                  <span className="text-xs text-muted-foreground">{c.label}</span>
                )}
                <span className="text-xs text-muted-foreground">{CONTACT_TYPE_LABELS[c.type]}</span>
                {c.is_primary && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                    <Star className="w-3 h-3 fill-current" />
                    Principal
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setEditingPendingIdx(idx)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="Editar contato"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onRemovePending(idx)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Remover contato"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )
      })}

      {/* Inline form */}
      {showForm && (
        <ContactInlineForm
          onSubmit={handleAddSubmit}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Add button */}
      {!showForm && editingPendingIdx === null && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className={cn(
            'flex items-center gap-2 h-10 px-4 rounded-lg border border-dashed border-border',
            'text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/30',
            'transition-colors w-full sm:w-auto',
          )}
        >
          <Plus className="w-4 h-4" />
          Adicionar contato
        </button>
      )}

      {totalContacts > 0 && (
        <p className="text-xs text-muted-foreground">
          {totalContacts} {totalContacts === 1 ? 'contato adicionado' : 'contatos adicionados'}
        </p>
      )}
    </div>
  )
}
