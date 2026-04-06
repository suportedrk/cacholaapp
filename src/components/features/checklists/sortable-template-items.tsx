'use client'

import { useState, useRef, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, Trash2, Plus, ChevronDown, ChevronUp,
  Camera, Star, Clock,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { PRIORITY_LABELS } from '@/types/database.types'
import type { Priority } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
export interface TemplateItemDraft {
  tempId: string
  description: string
  defaultPriority: Priority
  defaultEstimatedMinutes: number | null
  defaultAssignedToUserId: string | null
  notesTemplate: string | null
  requiresPhoto: boolean
  isRequired: boolean
}

export type TemplateUserOption = { id: string; name: string }

interface SortableTemplateItemsProps {
  items: TemplateItemDraft[]
  onChange: (items: TemplateItemDraft[]) => void
  users?: TemplateUserOption[]
  disabled?: boolean
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

const PRIORITY_BADGE: Record<Priority, string> = {
  low:    'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
  medium: '',
  high:   'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800',
  urgent: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
}

const FIELD_SELECT = 'w-full h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring'

function createEmptyItem(tempId: string): TemplateItemDraft {
  return {
    tempId,
    description: '',
    defaultPriority: 'medium',
    defaultEstimatedMinutes: null,
    defaultAssignedToUserId: null,
    notesTemplate: null,
    requiresPhoto: false,
    isRequired: true,
  }
}

// ─────────────────────────────────────────────────────────────
// SORTABLE ITEM
// ─────────────────────────────────────────────────────────────

interface SortableItemProps {
  item: TemplateItemDraft
  onUpdate: (updates: Partial<TemplateItemDraft>) => void
  onRemove: () => void
  onAddAfter: () => void
  users: TemplateUserOption[]
  autoFocus: boolean
  disabled?: boolean
}

function SortableItem({
  item, onUpdate, onRemove, onAddAfter, users, autoFocus, disabled,
}: SortableItemProps) {
  const [expanded, setExpanded] = useState(false)
  const descRef = useRef<HTMLInputElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.tempId })

  useEffect(() => {
    if (autoFocus) descRef.current?.focus()
  }, [autoFocus])

  function handleNotesChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
    onUpdate({ notesTemplate: el.value || null })
  }

  function handleDescKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      onAddAfter()
    } else if (e.key === 'Escape' && !item.description.trim()) {
      onRemove()
    }
  }

  const showPriorityBadge = item.defaultPriority !== 'medium'
  const hasTime = (item.defaultEstimatedMinutes ?? 0) > 0

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'rounded-xl border border-border bg-card transition-shadow',
        isDragging && 'shadow-lg ring-2 ring-primary/20 z-50 opacity-90',
      )}
    >
      {/* ── Collapsed row ── */}
      <div className="flex items-center gap-2 px-2 py-2 min-h-[44px]">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          disabled={disabled}
          className="flex items-center justify-center w-6 h-6 text-muted-foreground/40 cursor-grab active:cursor-grabbing shrink-0 touch-none hover:text-muted-foreground transition-colors"
          aria-label="Arrastar para reordenar"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        {/* Description input */}
        <input
          ref={descRef}
          type="text"
          value={item.description}
          onChange={(e) => onUpdate({ description: e.target.value })}
          onKeyDown={handleDescKeyDown}
          disabled={disabled}
          placeholder="Descreva o item… (Enter para adicionar outro)"
          className="flex-1 min-w-0 text-sm bg-transparent outline-none placeholder:text-muted-foreground/40 text-foreground"
        />

        {/* Compact summary badges */}
        <div className="flex items-center gap-1 shrink-0">
          {showPriorityBadge && (
            <span className={cn(
              'text-[10px] px-1 py-0.5 rounded border leading-none font-medium',
              PRIORITY_BADGE[item.defaultPriority],
            )}>
              {PRIORITY_LABELS[item.defaultPriority]}
            </span>
          )}
          {hasTime && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <Clock className="w-2.5 h-2.5" />
              {item.defaultEstimatedMinutes}m
            </span>
          )}
          {item.requiresPhoto && (
            <Camera className="w-3 h-3 text-blue-400" aria-label="Requer foto" />
          )}
          {item.isRequired && (
            <Star className="w-3 h-3 text-amber-400" aria-label="Obrigatório" />
          )}
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          disabled={disabled}
          className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted transition-colors shrink-0"
          aria-label={expanded ? 'Colapsar' : 'Configurar item'}
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {/* Delete */}
        <button
          onClick={onRemove}
          disabled={disabled}
          className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
          aria-label="Remover item"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Expanded config ── */}
      {expanded && (
        <div className="border-t border-border/60 bg-muted/20 px-3 pb-3 pt-3 space-y-3 rounded-b-xl animate-fade-up" style={{ animationDuration: '150ms', animationFillMode: 'backwards' }}>
          {/* Row 1: Priority + Estimated time + Required */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Prioridade</label>
              <Select
                value={item.defaultPriority}
                onValueChange={(v) => v && onUpdate({ defaultPriority: v as Priority })}
                disabled={disabled}
              >
                <SelectTrigger size="sm" className="w-full">
                  <span data-slot="select-value" className="flex flex-1 text-left">
                    {PRIORITY_LABELS[item.defaultPriority]}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tempo (min)</label>
              <input
                type="number"
                min={0}
                max={999}
                value={item.defaultEstimatedMinutes ?? ''}
                onChange={(e) => onUpdate({
                  defaultEstimatedMinutes: e.target.value ? parseInt(e.target.value, 10) : null,
                })}
                disabled={disabled}
                placeholder="—"
                className="w-full h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Star className="w-2.5 h-2.5 text-amber-400" />
                Obrigatório
              </label>
              <div className="flex items-center h-8">
                <Switch
                  checked={item.isRequired}
                  onCheckedChange={(v) => onUpdate({ isRequired: v })}
                  disabled={disabled}
                />
              </div>
            </div>
          </div>

          {/* Row 2: Requires photo + Assignee */}
          <div className={cn('grid gap-2', users.length > 0 ? 'grid-cols-2' : 'grid-cols-1')}>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Camera className="w-2.5 h-2.5" />
                Requer foto
              </label>
              <div className="flex items-center h-8">
                <Switch
                  checked={item.requiresPhoto}
                  onCheckedChange={(v) => onUpdate({ requiresPhoto: v })}
                  disabled={disabled}
                />
              </div>
            </div>

            {users.length > 0 && (
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Responsável padrão</label>
                <Select
                  value={item.defaultAssignedToUserId || null}
                  onValueChange={(v) => onUpdate({ defaultAssignedToUserId: v ?? null })}
                  disabled={disabled}
                >
                  <SelectTrigger size="sm" className="w-full">
                    {item.defaultAssignedToUserId
                      ? <span data-slot="select-value" className="flex flex-1 text-left">{users.find((u) => u.id === item.defaultAssignedToUserId)?.name.split(' ').slice(0, 2).join(' ') ?? 'Usuário'}</span>
                      : <SelectValue placeholder="Nenhum" />}
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name.split(' ').slice(0, 2).join(' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Row 3: Notes template */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Instruções padrão</label>
            <textarea
              ref={notesRef}
              value={item.notesTemplate ?? ''}
              onChange={handleNotesChange}
              disabled={disabled}
              placeholder="Instruções que aparecerão como texto de ajuda nas notas do item..."
              rows={2}
              style={{ resize: 'none', overflow: 'hidden' }}
              className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export function SortableTemplateItems({
  items,
  onChange,
  users = [],
  disabled,
}: SortableTemplateItemsProps) {
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.tempId === active.id)
    const newIndex = items.findIndex((i) => i.tempId === over.id)
    onChange(arrayMove(items, oldIndex, newIndex))
  }

  function addItem(afterTempId?: string) {
    // eslint-disable-next-line react-hooks/purity
    const newId = `new-${Date.now()}`
    if (afterTempId) {
      const afterIdx = items.findIndex((i) => i.tempId === afterTempId)
      const newItems = [...items]
      newItems.splice(afterIdx + 1, 0, createEmptyItem(newId))
      onChange(newItems)
    } else {
      onChange([...items, createEmptyItem(newId)])
    }
    setAutoFocusId(newId)
  }

  function updateItem(tempId: string, updates: Partial<TemplateItemDraft>) {
    onChange(items.map((i) => (i.tempId === tempId ? { ...i, ...updates } : i)))
  }

  function removeItem(tempId: string) {
    onChange(items.filter((i) => i.tempId !== tempId))
    if (autoFocusId === tempId) setAutoFocusId(null)
  }

  return (
    <div className="space-y-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.tempId)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => (
            <SortableItem
              key={item.tempId}
              item={item}
              onUpdate={(updates) => updateItem(item.tempId, updates)}
              onRemove={() => removeItem(item.tempId)}
              onAddAfter={() => addItem(item.tempId)}
              users={users}
              autoFocus={item.tempId === autoFocusId}
              disabled={disabled}
            />
          ))}
        </SortableContext>
      </DndContext>

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6 border border-dashed border-border rounded-xl">
          Nenhum item ainda. Clique em &quot;+ Adicionar item&quot; para começar.
        </p>
      )}

      <button
        onClick={() => addItem()}
        disabled={disabled}
        className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors font-medium py-1.5 disabled:opacity-40"
      >
        <Plus className="w-4 h-4" />
        Adicionar item
      </button>
    </div>
  )
}
