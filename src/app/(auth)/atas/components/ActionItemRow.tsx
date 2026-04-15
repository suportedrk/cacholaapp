'use client'

import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ACTION_ITEM_STATUS_LABELS } from '@/types/minutes'
import type { ActionItemDraft, ActionItemStatus } from '@/types/minutes'

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface UnitUser {
  id:        string
  name:      string
  is_active: boolean
}

interface Props {
  item:       ActionItemDraft
  index:      number
  unitUsers:  UnitUser[]
  isEditMode: boolean
  onChange:   (item: ActionItemDraft) => void
  onRemove:   () => void
}

// ─────────────────────────────────────────────────────────────
// ActionItemRow
// ─────────────────────────────────────────────────────────────

export function ActionItemRow({ item, index, unitUsers, isEditMode, onChange, onRemove }: Props) {
  const isDone = item.status === 'done'
  // In edit mode, done items are fully disabled
  const isDisabled = isEditMode && isDone

  return (
    <div className={cn(
      'rounded-lg border border-border bg-background p-3 space-y-3',
      isDisabled && 'opacity-60',
    )}>
      {/* Header: index + remove button */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Item {index + 1}
          {isDone && <span className="ml-1.5 text-status-success-text">(Concluído)</span>}
        </span>
        {!isDisabled && (
          <button
            type="button"
            onClick={onRemove}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            aria-label="Remover item"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          Descrição <span className="text-destructive">*</span>
        </label>
        <textarea
          value={item.description}
          onChange={(e) => onChange({ ...item, description: e.target.value })}
          disabled={isDisabled}
          rows={2}
          placeholder="Descreva o item de ação..."
          className={cn(
            'w-full rounded-lg border border-border bg-background px-3 py-2',
            'text-sm text-foreground placeholder:text-muted-foreground resize-none',
            'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
            'transition-colors disabled:cursor-not-allowed',
          )}
        />
      </div>

      {/* Row: Assignee + Due date + Status (edit only) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Assignee */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Responsável
          </label>
          <Select
            value={item.assigned_to ?? 'none'}
            onValueChange={(v) => onChange({ ...item, assigned_to: v === 'none' ? null : v })}
            disabled={isDisabled}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue placeholder="Nenhum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {unitUsers.filter((u) => u.is_active).map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Due date */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Prazo
          </label>
          <input
            type="date"
            value={item.due_date ?? ''}
            onChange={(e) => onChange({ ...item, due_date: e.target.value || null })}
            disabled={isDisabled}
            className={cn(
              'w-full h-9 rounded-lg border border-border bg-background px-3',
              'text-sm text-foreground',
              'focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary',
              'transition-colors disabled:cursor-not-allowed',
            )}
          />
        </div>
      </div>

      {/* Status — only shown in edit mode */}
      {isEditMode && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Status
          </label>
          <Select
            value={item.status}
            onValueChange={(v) => onChange({ ...item, status: v as ActionItemStatus })}
            disabled={isDisabled}
          >
            <SelectTrigger size="sm" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.entries(ACTION_ITEM_STATUS_LABELS) as [ActionItemStatus, string][]).map(
                ([status, label]) => (
                  <SelectItem key={status} value={status}>{label}</SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  )
}
