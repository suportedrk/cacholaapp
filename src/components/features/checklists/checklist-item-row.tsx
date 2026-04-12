'use client'

import { useState, useRef } from 'react'
import { Camera, MessageSquare, Minus, X } from 'lucide-react'
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

// Classes visuais do círculo interno (não do touch target)
const STATUS_STYLE: Record<ChecklistItemStatus, string> = {
  pending: 'border-border bg-background text-muted-foreground',
  done:    'border-green-500 bg-green-500 text-white',
  na:      'border-border bg-muted text-muted-foreground',
}

export function ChecklistItemRow({
  item,
  onStatusChange,
  onNotesChange,
  onPhotoChange,
  disabled,
}: ChecklistItemRowProps) {
  const [notesOpen, setNotesOpen]   = useState(!!item.notes)
  const [localNotes, setLocalNotes] = useState(item.notes ?? '')
  const [justDone, setJustDone]     = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isDone = item.status === 'done'
  const isNa   = item.status === 'na'

  function handleCycle() {
    if (disabled) return
    const next = STATUS_CYCLE[item.status]

    if (next === 'done') {
      // Flash de sucesso
      setJustDone(true)
      setTimeout(() => setJustDone(false), 600)
      // Haptic feedback (mobile)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10)
      }
    }

    onStatusChange(next)
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

  return (
    <div
      className={cn(
        'relative rounded-xl border transition-colors duration-300',
        isDone ? 'bg-green-50/60 border-green-100 dark:bg-green-950/20 dark:border-green-900/30' :
        isNa   ? 'bg-muted/40 border-border/60' :
                 'bg-card border-border'
      )}
    >
      {/* Flash overlay ao concluir */}
      {justDone && (
        <div className="absolute inset-0 rounded-xl bg-green-400/20 pointer-events-none animate-item-flash" />
      )}

      <div className="flex items-start gap-1 p-2">
        {/* ── Checkbox — 48px touch target ── */}
        <button
          onClick={handleCycle}
          disabled={disabled}
          className={cn(
            'flex items-center justify-center w-12 h-12 rounded-xl shrink-0 transition-all duration-150',
            !disabled && 'active:scale-90 touch-manipulation'
          )}
          aria-label={`Status: ${item.status}. Toque para alternar.`}
        >
          <span
            className={cn(
              'flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all duration-200',
              STATUS_STYLE[item.status]
            )}
          >
            {isDone ? (
              /* SVG inline com animação de draw */
              <svg
                viewBox="0 0 16 16"
                fill="none"
                className="w-4 h-4"
                aria-hidden
              >
                <path
                  key={`check-${item.id}-done`}
                  d="M3 8.5 6.5 12 13 5"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-check-draw"
                />
              </svg>
            ) : isNa ? (
              <Minus className="w-3.5 h-3.5" />
            ) : null}
          </span>
        </button>

        {/* ── Conteúdo ── */}
        <div className="flex-1 min-w-0 py-2 pr-1">
          {/* Descrição do item */}
          <p
            className={cn(
              'text-base leading-snug font-medium',
              isDone && 'line-through text-muted-foreground',
              isNa   && 'text-muted-foreground'
            )}
          >
            {item.description}
          </p>

          {/* Foto existente */}
          {item.photo_url && (
            <img
              src={item.photo_url}
              alt="Foto do item"
              className="mt-2 rounded-lg w-full max-w-[200px] object-cover border border-border"
            />
          )}

          {/* Notas: campo expandido OU botão "Adicionar nota" */}
          {notesOpen ? (
            <div className="mt-2 space-y-1">
              <textarea
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                onBlur={handleNotesBlur}
                placeholder="Observação sobre este item..."
                rows={2}
                disabled={disabled}
                autoFocus
                className="w-full text-sm text-foreground bg-background border border-border rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
              />
              <button
                onClick={() => {
                  handleNotesBlur()
                  setNotesOpen(false)
                }}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Fechar nota
              </button>
            </div>
          ) : !disabled ? (
            <button
              onClick={() => setNotesOpen(true)}
              className={cn(
                'mt-1.5 text-xs flex items-center gap-1 transition-colors',
                item.notes
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <MessageSquare className="w-3 h-3" />
              {item.notes ? 'Ver nota' : 'Adicionar nota'}
            </button>
          ) : item.notes ? (
            <p className="mt-1.5 text-xs text-muted-foreground italic">{item.notes}</p>
          ) : null}
        </div>

        {/* ── Câmera ── */}
        {onPhotoChange && !disabled && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-lg transition-colors mt-2 shrink-0',
              item.photo_url
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted'
            )}
            aria-label="Adicionar foto"
          >
            <Camera className="w-4 h-4" />
          </button>
        )}
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
