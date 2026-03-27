'use client'

import { useState, useRef } from 'react'
import { Camera, MessageSquare, Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChecklistItem, ChecklistItemStatus } from '@/types/database.types'

interface ChecklistItemRowProps {
  item: ChecklistItem
  onStatusChange: (status: ChecklistItemStatus) => void
  onNotesChange: (notes: string) => void
  onPhotoChange?: (file: File) => void
  disabled?: boolean
}

const STATUS_CYCLE: Record<ChecklistItemStatus, ChecklistItemStatus> = {
  pending: 'done',
  done:    'na',
  na:      'pending',
}

const STATUS_ICON: Record<ChecklistItemStatus, React.ReactNode> = {
  pending: null,
  done:    <Check className="w-4 h-4" />,
  na:      <Minus className="w-3.5 h-3.5" />,
}

const STATUS_STYLE: Record<ChecklistItemStatus, string> = {
  pending: 'bg-background border-border text-muted-foreground',
  done:    'bg-green-500 border-green-500 text-white',
  na:      'bg-gray-200 border-gray-200 text-gray-500 dark:bg-gray-700 dark:border-gray-600',
}

export function ChecklistItemRow({
  item,
  onStatusChange,
  onNotesChange,
  onPhotoChange,
  disabled,
}: ChecklistItemRowProps) {
  const [notesOpen, setNotesOpen] = useState(!!item.notes)
  const [localNotes, setLocalNotes] = useState(item.notes ?? '')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleCycle() {
    if (disabled) return
    onStatusChange(STATUS_CYCLE[item.status])
  }

  function handleNotesBlur() {
    if (localNotes !== (item.notes ?? '')) {
      onNotesChange(localNotes)
    }
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onPhotoChange?.(file)
  }

  const isDone = item.status === 'done'
  const isNa   = item.status === 'na'

  return (
    <div
      className={cn(
        'rounded-xl border transition-colors',
        isDone ? 'bg-green-50/50 border-green-100 dark:bg-green-950/20 dark:border-green-900/30' :
        isNa   ? 'bg-muted/40 border-border' :
                 'bg-card border-border'
      )}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Status toggle — grande para toque mobile */}
        <button
          onClick={handleCycle}
          disabled={disabled}
          className={cn(
            'flex items-center justify-center w-8 h-8 rounded-full border-2 shrink-0 mt-0.5 transition-all duration-200',
            STATUS_STYLE[item.status],
            !disabled && 'active:scale-95'
          )}
          aria-label={`Status: ${item.status}. Toque para alternar.`}
        >
          {STATUS_ICON[item.status]}
        </button>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <p
            className={cn(
              'text-sm leading-snug',
              isDone && 'line-through text-muted-foreground',
              isNa   && 'text-muted-foreground'
            )}
          >
            {item.description}
          </p>

          {/* Foto se existir */}
          {item.photo_url && (
            <img
              src={item.photo_url}
              alt="Foto do item"
              className="mt-1 rounded-lg w-full max-w-[200px] object-cover border border-border"
            />
          )}

          {/* Notas inline */}
          {notesOpen && (
            <textarea
              value={localNotes}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder="Observação..."
              rows={2}
              disabled={disabled}
              className="w-full text-xs text-foreground bg-background border border-border rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/60"
            />
          )}
        </div>

        {/* Ações secundárias */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <button
            onClick={() => setNotesOpen((v) => !v)}
            disabled={disabled}
            className={cn(
              'flex items-center justify-center w-7 h-7 rounded-lg transition-colors',
              notesOpen || item.notes
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted'
            )}
            aria-label="Observação"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className={cn(
              'flex items-center justify-center w-7 h-7 rounded-lg transition-colors',
              item.photo_url
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted'
            )}
            aria-label="Foto"
          >
            <Camera className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoSelect}
      />
    </div>
  )
}
