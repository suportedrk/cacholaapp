'use client'

import { useState } from 'react'
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
import { GripVertical, Trash2, Plus, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select'
import type { CommercialTemplateItem } from '@/hooks/commercial-checklist/use-commercial-template-items'

// ── Types ─────────────────────────────────────────────────────

export interface TemplateItemDraft {
  tempId:      string
  title:       string
  description: string
  priority:    'low' | 'medium' | 'high'
  due_in_days: string
}

interface SortableItemRowProps {
  item:     TemplateItemDraft
  onChange: (updated: TemplateItemDraft) => void
  onDelete: () => void
}

// ── Single sortable item ──────────────────────────────────────

function SortableItemRow({ item, onChange, onDelete }: SortableItemRowProps) {
  const [expanded, setExpanded] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.tempId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity:   isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-lg border border-border bg-card"
    >
      {/* Header row */}
      <div className="flex items-center gap-2 p-3">
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="shrink-0 cursor-grab text-text-tertiary hover:text-text-secondary touch-none"
          aria-label="Arrastar"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Title */}
        <Input
          value={item.title}
          onChange={(e) => onChange({ ...item, title: e.target.value })}
          placeholder="Título do item"
          className="flex-1 h-8 text-sm"
        />

        {/* Priority chip inline */}
        <Select
          value={item.priority}
          onValueChange={(v) => onChange({ ...item, priority: v as 'low' | 'medium' | 'high' })}
        >
          <SelectTrigger className="w-24 h-8 text-xs">
            <span data-slot="select-value">
              {item.priority === 'low' ? 'Baixa' : item.priority === 'medium' ? 'Média' : 'Alta'}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Baixa</SelectItem>
            <SelectItem value="medium">Média</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
          </SelectContent>
        </Select>

        {/* Expand */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 text-text-tertiary hover:text-text-secondary"
          aria-label="Expandir"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="shrink-0 text-text-tertiary hover:text-status-error-text transition-colors"
          aria-label="Remover item"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Expanded section */}
      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
          <Input
            value={item.description}
            onChange={(e) => onChange({ ...item, description: e.target.value })}
            placeholder="Descrição (opcional)"
            className="text-sm"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary whitespace-nowrap">Prazo (dias):</span>
            <Input
              type="number"
              min={1}
              value={item.due_in_days}
              onChange={(e) => onChange({ ...item, due_in_days: e.target.value })}
              placeholder="Herda do template"
              className="w-32 h-8 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── List component (exported) ─────────────────────────────────

interface TemplateItemListProps {
  items:    TemplateItemDraft[]
  onChange: (items: TemplateItemDraft[]) => void
}

export function TemplateItemList({ items, onChange }: TemplateItemListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.tempId === active.id)
    const newIndex = items.findIndex((i) => i.tempId === over.id)
    onChange(arrayMove(items, oldIndex, newIndex))
  }

  function addItem() {
    onChange([
      ...items,
      {
        tempId:      crypto.randomUUID(),
        title:       '',
        description: '',
        priority:    'medium',
        due_in_days: '',
      },
    ])
  }

  function updateItem(tempId: string, updated: TemplateItemDraft) {
    onChange(items.map((i) => (i.tempId === tempId ? updated : i)))
  }

  function deleteItem(tempId: string) {
    onChange(items.filter((i) => i.tempId !== tempId))
  }

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.tempId)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableItemRow
              key={item.tempId}
              item={item}
              onChange={(updated) => updateItem(item.tempId, updated)}
              onDelete={() => deleteItem(item.tempId)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addItem}
        className="w-full border-dashed"
      >
        <Plus className="h-4 w-4 mr-1.5" />
        Adicionar item
      </Button>
    </div>
  )
}

// ── Converter para CommercialTemplateItem existentes → drafts ─

export function existingItemsToDrafts(items: CommercialTemplateItem[]): TemplateItemDraft[] {
  return items.map((i) => ({
    tempId:      i.id,
    title:       i.title,
    description: i.description ?? '',
    priority:    i.priority,
    due_in_days: i.due_in_days != null ? String(i.due_in_days) : '',
  }))
}
