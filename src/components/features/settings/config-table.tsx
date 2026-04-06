'use client'

import { useState } from 'react'
import { Plus, Pencil, Trash2, Check, X, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { cn } from '@/lib/utils'
import { useIsReadOnly } from '@/hooks/use-read-only'

export interface ConfigItem {
  id: string
  name: string
  is_active: boolean
  sort_order: number
  [key: string]: unknown
}

interface ConfigTableProps {
  title: string
  items: ConfigItem[]
  isLoading?: boolean
  extraField?: {
    key: string
    label: string
    placeholder?: string
    type?: 'text' | 'number'
  }
  onCreate: (data: { name: string; [key: string]: unknown }) => Promise<void>
  onUpdate: (id: string, data: Partial<ConfigItem>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

interface EditState {
  id: string
  name: string
  extra: string
}

export function ConfigTable({
  title,
  items,
  isLoading,
  extraField,
  onCreate,
  onUpdate,
  onDelete,
}: ConfigTableProps) {
  const [newName, setNewName] = useState('')
  const [newExtra, setNewExtra] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ConfigItem | null>(null)
  const [saving, setSaving] = useState(false)
  const isReadOnly = useIsReadOnly()

  async function handleCreate() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      const data: { name: string; [key: string]: unknown } = { name: newName.trim() }
      if (extraField) data[extraField.key] = extraField.type === 'number' ? Number(newExtra) || null : newExtra || null
      await onCreate(data)
      setNewName('')
      setNewExtra('')
      setIsCreating(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEdit() {
    if (!editState || !editState.name.trim()) return
    setSaving(true)
    try {
      const data: Partial<ConfigItem> = { name: editState.name.trim() }
      if (extraField) data[extraField.key] = extraField.type === 'number' ? Number(editState.extra) || null : editState.extra || null
      await onUpdate(editState.id, data)
      setEditState(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(item: ConfigItem) {
    await onUpdate(item.id, { is_active: !item.is_active })
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setSaving(true)
    try {
      await onDelete(deleteTarget.id)
      setDeleteTarget(null)
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Lista de itens */}
      <div className="divide-y divide-border border border-border rounded-xl overflow-hidden">
        {items.length === 0 && !isCreating && (
          <div className="p-4 text-sm text-muted-foreground text-center">
            Nenhum item cadastrado ainda.
          </div>
        )}

        {items.map((item) => {
          const isEditing = editState?.id === item.id
          return (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 bg-card transition-colors',
                !item.is_active && 'opacity-50'
              )}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0 cursor-grab" />

              {isEditing ? (
                <>
                  <Input
                    value={editState.name}
                    onChange={(e) => setEditState((s) => s ? { ...s, name: e.target.value } : s)}
                    className="h-8 text-sm flex-1"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditState(null) }}
                  />
                  {extraField && (
                    <Input
                      value={editState.extra}
                      onChange={(e) => setEditState((s) => s ? { ...s, extra: e.target.value } : s)}
                      placeholder={extraField.label}
                      type={extraField.type}
                      className="h-8 text-sm w-28 shrink-0"
                    />
                  )}
                  <button onClick={handleSaveEdit} disabled={saving} className="text-green-600 hover:text-green-700 shrink-0">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditState(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">
                    {item.name}
                  </span>
                  {extraField && item[extraField.key] != null && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {extraField.label}: {String(item[extraField.key])}
                    </span>
                  )}
                  <Switch
                    checked={item.is_active}
                    onCheckedChange={() => !isReadOnly && handleToggleActive(item)}
                    disabled={isReadOnly}
                    className="shrink-0"
                    aria-label={item.is_active ? 'Desativar' : 'Ativar'}
                  />
                  {!isReadOnly && (
                    <>
                      <button
                        onClick={() => setEditState({
                          id: item.id,
                          name: item.name,
                          extra: extraField ? String(item[extraField.key] ?? '') : '',
                        })}
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(item)}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          )
        })}

        {/* Linha de criação inline */}
        {isCreating && (
          <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/30">
            <div className="w-4 shrink-0" />
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome..."
              className="h-8 text-sm flex-1"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setIsCreating(false) }}
            />
            {extraField && (
              <Input
                value={newExtra}
                onChange={(e) => setNewExtra(e.target.value)}
                placeholder={extraField.placeholder ?? extraField.label}
                type={extraField.type}
                className="h-8 text-sm w-28 shrink-0"
              />
            )}
            <button onClick={handleCreate} disabled={saving || !newName.trim()} className="text-green-600 hover:text-green-700 shrink-0 disabled:opacity-40">
              <Check className="w-4 h-4" />
            </button>
            <button onClick={() => { setIsCreating(false); setNewName(''); setNewExtra('') }} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {!isCreating && !isReadOnly && (
        <Button variant="outline" size="sm" onClick={() => setIsCreating(true)} className="w-full sm:w-auto">
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Adicionar {title.toLowerCase()}
        </Button>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`Remover "${deleteTarget?.name}"?`}
        description="Esta ação não pode ser desfeita. Eventos que usam este item podem ser afetados."
        confirmLabel="Remover"
        loading={saving}
        onConfirm={handleDelete}
      />
    </div>
  )
}
