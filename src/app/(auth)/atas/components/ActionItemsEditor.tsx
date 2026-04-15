'use client'

import { Plus } from 'lucide-react'
import { ActionItemRow } from './ActionItemRow'
import type { ActionItemDraft } from '@/types/minutes'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface UnitUser {
  id:        string
  name:      string
  is_active: boolean
}

interface Props {
  items:      ActionItemDraft[]
  unitUsers:  UnitUser[]
  isEditMode: boolean
  onChange:   (items: ActionItemDraft[]) => void
}

// ─────────────────────────────────────────────────────────────
// ActionItemsEditor
// ─────────────────────────────────────────────────────────────

export function ActionItemsEditor({ items, unitUsers, isEditMode, onChange }: Props) {
  function handleAdd() {
    const draft: ActionItemDraft = {
      _key:        crypto.randomUUID(),
      description: '',
      assigned_to: null,
      due_date:    null,
      status:      'pending',
    }
    onChange([...items, draft])
  }

  function handleChange(key: string, updated: ActionItemDraft) {
    onChange(items.map((item) => item._key === key ? updated : item))
  }

  function handleRemove(key: string) {
    onChange(items.filter((item) => item._key !== key))
  }

  return (
    <div className="space-y-3">
      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item, idx) => (
            <li key={item._key}>
              <ActionItemRow
                item={item}
                index={idx}
                unitUsers={unitUsers}
                isEditMode={isEditMode}
                onChange={(updated) => handleChange(item._key, updated)}
                onRemove={() => handleRemove(item._key)}
              />
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={handleAdd}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-muted/50 transition-colors"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        Adicionar item
      </button>
    </div>
  )
}
