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
import { GripVertical, Trash2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────
export interface TemplateItemDraft {
  // id temporário (string) para DnD — pode não existir no banco ainda
  tempId: string
  description: string
}

interface SortableTemplateItemsProps {
  items: TemplateItemDraft[]
  onChange: (items: TemplateItemDraft[]) => void
  disabled?: boolean
}

// ─────────────────────────────────────────────────────────────
// ITEM SORTÁVEL
// ─────────────────────────────────────────────────────────────
function SortableItem({
  item,
  onDescriptionChange,
  onRemove,
  disabled,
}: {
  item: TemplateItemDraft
  onDescriptionChange: (desc: string) => void
  onRemove: () => void
  disabled?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.tempId })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-2 transition-shadow',
        isDragging && 'shadow-md ring-1 ring-primary/20 z-50'
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        disabled={disabled}
        className="flex items-center justify-center w-5 h-5 text-muted-foreground/50 cursor-grab active:cursor-grabbing shrink-0 touch-none"
        aria-label="Arrastar para reordenar"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Input de descrição */}
      <input
        type="text"
        value={item.description}
        onChange={(e) => onDescriptionChange(e.target.value)}
        disabled={disabled}
        placeholder="Descreva o item..."
        className="flex-1 min-w-0 text-sm bg-transparent outline-none placeholder:text-muted-foreground/50 text-foreground"
      />

      {/* Remover */}
      <button
        onClick={onRemove}
        disabled={disabled}
        className="text-muted-foreground/50 hover:text-destructive transition-colors shrink-0"
        aria-label="Remover item"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────
export function SortableTemplateItems({
  items,
  onChange,
  disabled,
}: SortableTemplateItemsProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
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
      { tempId: `new-${Date.now()}`, description: '' },
    ])
  }

  function updateDesc(tempId: string, description: string) {
    onChange(items.map((i) => (i.tempId === tempId ? { ...i, description } : i)))
  }

  function removeItem(tempId: string) {
    onChange(items.filter((i) => i.tempId !== tempId))
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
              onDescriptionChange={(desc) => updateDesc(item.tempId, desc)}
              onRemove={() => removeItem(item.tempId)}
              disabled={disabled}
            />
          ))}
        </SortableContext>
      </DndContext>

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
          Nenhum item ainda. Adicione abaixo.
        </p>
      )}

      <button
        onClick={addItem}
        disabled={disabled}
        className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors font-medium py-1 disabled:opacity-40"
      >
        <Plus className="w-4 h-4" />
        Adicionar item
      </button>
    </div>
  )
}
