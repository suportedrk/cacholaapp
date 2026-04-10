'use client'

import { useState, useRef, useCallback } from 'react'
import {
  format, parseISO, isToday, isTomorrow, isPast, startOfDay,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Camera, MessageSquare, Minus, X,
  User, Calendar, MoreVertical, Clock, MessageCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/shared/user-avatar'
import { ItemAssignPopover, type AssignedUser } from './item-assign-popover'
import { ItemDeadlinePopover } from './item-deadline-popover'
import { ItemCommentsSheet } from './item-comments-sheet'
import { useUpdateChecklistItem } from '@/hooks/use-checklists'
import type { ChecklistItem, ChecklistItemStatus, Priority, User as UserType } from '@/types/database.types'
import { PRIORITY_LABELS } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
export type RichChecklistItem = ChecklistItem & {
  assigned_user?: Pick<UserType, 'id' | 'name' | 'avatar_url'> | null
  done_by_user?:  Pick<UserType, 'id' | 'name' | 'avatar_url'> | null
}

interface ChecklistItemRowProps {
  item:           RichChecklistItem
  checklistId:    string
  onStatusChange: (status: ChecklistItemStatus) => void
  onNotesChange:  (notes: string) => void
  onPhotoChange?:  (file: File) => void
  disabled?:       boolean
  currentUserId?:  string
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const STATUS_CYCLE: Record<ChecklistItemStatus, ChecklistItemStatus> = {
  pending: 'done',
  done:    'na',
  na:      'pending',
}

const STATUS_CIRCLE: Record<ChecklistItemStatus, string> = {
  pending: 'border-border bg-background',
  done:    'border-green-500 bg-green-500 text-white',
  na:      'border-gray-300 bg-gray-100 text-gray-400 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-500',
}

const PRIORITY_BG: Record<Priority, string> = {
  low:    'badge-green border',
  medium: 'badge-amber border',
  high:   'badge-orange border',
  urgent: 'badge-red border',
}

function dueDateInfo(dueAt: string | null): { label: string; cls: string } | null {
  if (!dueAt) return null
  const d = startOfDay(parseISO(dueAt))
  if (isPast(d) && !isToday(d)) {
    return { label: 'Atrasado', cls: 'text-red-600 dark:text-red-400' }
  }
  if (isToday(d))     return { label: 'Hoje',   cls: 'text-amber-600 dark:text-amber-400' }
  if (isTomorrow(d))  return { label: 'Amanhã', cls: 'text-yellow-600 dark:text-yellow-400' }
  return {
    label: format(d, "d 'de' MMM", { locale: ptBR }),
    cls: 'text-muted-foreground',
  }
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export function ChecklistItemRow({
  item,
  checklistId,
  onStatusChange,
  onNotesChange,
  onPhotoChange,
  disabled,
  currentUserId: _currentUserId,
}: ChecklistItemRowProps) {
  const { mutate: updateItem } = useUpdateChecklistItem()

  // Local optimistic state for assign + deadline
  const [localAssigned, setLocalAssigned] = useState<AssignedUser | null>(
    item.assigned_user ?? null,
  )
  const [localDueAt, setLocalDueAt] = useState<string | null>(item.due_at ?? null)

  // UI state
  const [notesOpen,    setNotesOpen]    = useState(!!item.notes)
  const [localNotes,   setLocalNotes]   = useState(item.notes ?? '')
  const [justDone,     setJustDone]     = useState(false)
  const [assignOpen,    setAssignOpen]    = useState(false)
  const [deadlineOpen,  setDeadlineOpen]  = useState(false)
  const [menuOpen,      setMenuOpen]      = useState(false)
  const [commentsOpen,  setCommentsOpen]  = useState(false)
  const [commentsCount, setCommentsCount] = useState(0)

  const fileInputRef  = useRef<HTMLInputElement>(null)
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const isDone    = item.status === 'done'
  const isNa      = item.status === 'na'
  const isOverdue = !isDone && !isNa && localDueAt
    && isPast(startOfDay(parseISO(localDueAt))) && !isToday(parseISO(localDueAt))
  const isUrgent  = item.priority === 'urgent'

  // ── Status cycle ────────────────────────────────────────────
  function handleCycle() {
    if (disabled) return
    const next = STATUS_CYCLE[item.status]
    if (next === 'done') {
      setJustDone(true)
      setTimeout(() => setJustDone(false), 600)
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(10)
      }
    }
    onStatusChange(next)
  }

  // ── Notes (1s debounce auto-save) ───────────────────────────
  const handleNotesChange = useCallback((val: string) => {
    setLocalNotes(val)
    clearTimeout(notesTimerRef.current)
    notesTimerRef.current = setTimeout(() => {
      if (val !== (item.notes ?? '')) onNotesChange(val)
    }, 1000)
  }, [item.notes, onNotesChange])

  function handleNotesBlur() {
    clearTimeout(notesTimerRef.current)
    if (localNotes !== (item.notes ?? '')) onNotesChange(localNotes)
  }

  // ── Photo ────────────────────────────────────────────────────
  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onPhotoChange?.(file)
  }

  // ── Assign (optimistic) ─────────────────────────────────────
  function handleAssign(user: AssignedUser | null) {
    setLocalAssigned(user)
    updateItem({
      itemId: item.id,
      checklistId,
      assignedTo: user?.id ?? null,
    })
  }

  // ── Deadline (optimistic) ───────────────────────────────────
  function handleSetDeadline(dueAt: string | null) {
    setLocalDueAt(dueAt)
    updateItem({
      itemId: item.id,
      checklistId,
      dueAt,
    })
  }

  const dueInfo = dueDateInfo(localDueAt)

  return (
    <>
      <div
        className={cn(
          'relative rounded-xl border transition-colors duration-300',
          isOverdue
            ? 'border-l-4 border-l-red-400 border-border/60 bg-card'
            : isDone
            ? 'bg-green-50/60 border-green-100 dark:bg-green-950/20 dark:border-green-900/30'
            : isNa
            ? 'bg-muted/40 border-border/60'
            : isUrgent && !disabled
            ? 'bg-red-50/40 border-red-100 dark:bg-red-950/10 dark:border-red-900/20'
            : 'bg-card border-border',
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
              !disabled && 'active:scale-90 touch-manipulation',
            )}
            aria-label={`Status: ${item.status}. Toque para alternar.`}
          >
            <span
              className={cn(
                'flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all duration-200',
                STATUS_CIRCLE[item.status],
              )}
            >
              {isDone ? (
                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden>
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

          {/* ── Main content ── */}
          <div className="flex-1 min-w-0 py-2 pr-1">
            {/* Row 1: description + priority badge */}
            <div className="flex items-start gap-2">
              <p
                className={cn(
                  'flex-1 text-base leading-snug font-medium',
                  isDone && 'line-through text-muted-foreground',
                  isNa   && 'text-muted-foreground',
                )}
              >
                {item.description}
                {item.is_required && !isDone && !isNa && (
                  <span className="ml-1 text-red-500 text-xs align-super">*</span>
                )}
              </p>
              {item.priority && item.priority !== 'medium' && (
                <span
                  className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0',
                    PRIORITY_BG[item.priority],
                  )}
                >
                  {PRIORITY_LABELS[item.priority]}
                </span>
              )}
            </div>

            {/* Row 2: metadata (assigned + due date + estimated) */}
            {!isDone && !isNa && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                {/* Assigned */}
                {!disabled && (
                  <button
                    onClick={() => setAssignOpen(true)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {localAssigned ? (
                      <>
                        <UserAvatar
                          name={localAssigned.name}
                          avatarUrl={localAssigned.avatar_url}
                          size="sm"
                          className="w-4 h-4 text-[9px]"
                        />
                        <span>{localAssigned.name.split(' ')[0]}</span>
                      </>
                    ) : (
                      <>
                        <User className="w-3.5 h-3.5" />
                        <span>Atribuir</span>
                      </>
                    )}
                  </button>
                )}
                {disabled && localAssigned && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <UserAvatar
                      name={localAssigned.name}
                      avatarUrl={localAssigned.avatar_url}
                      size="sm"
                      className="w-4 h-4 text-[9px]"
                    />
                    {localAssigned.name.split(' ')[0]}
                  </span>
                )}

                {/* Due date */}
                {!disabled ? (
                  <button
                    onClick={() => setDeadlineOpen(true)}
                    className={cn(
                      'flex items-center gap-1 text-xs transition-colors',
                      dueInfo ? dueInfo.cls : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{dueInfo ? dueInfo.label : 'Prazo'}</span>
                  </button>
                ) : dueInfo ? (
                  <span className={cn('flex items-center gap-1 text-xs', dueInfo.cls)}>
                    <Calendar className="w-3.5 h-3.5" />
                    {dueInfo.label}
                  </span>
                ) : null}

                {/* Estimated minutes */}
                {item.estimated_minutes && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    {item.estimated_minutes < 60
                      ? `${item.estimated_minutes}min`
                      : `${Math.round(item.estimated_minutes / 60)}h`}
                  </span>
                )}
              </div>
            )}

            {/* Done by (read-only) */}
            {isDone && item.done_by_user && (
              <p className="text-xs text-muted-foreground mt-1">
                Concluído por{' '}
                <span className="font-medium">{item.done_by_user.name.split(' ')[0]}</span>
              </p>
            )}

            {/* Photo */}
            {item.photo_url && (
              <img
                src={item.photo_url}
                alt="Foto do item"
                className="mt-2 rounded-lg w-full max-w-[200px] object-cover border border-border"
              />
            )}

            {/* Notes */}
            {notesOpen ? (
              <div className="mt-2 space-y-1">
                <textarea
                  value={localNotes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  onBlur={handleNotesBlur}
                  placeholder="Observação sobre este item..."
                  rows={2}
                  disabled={disabled}
                  autoFocus
                  className="w-full text-sm text-foreground bg-background border border-border rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
                />
                <button
                  onClick={() => { handleNotesBlur(); setNotesOpen(false) }}
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
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <MessageSquare className="w-3 h-3" />
                {item.notes ? 'Ver nota' : 'Adicionar nota'}
              </button>
            ) : item.notes ? (
              <p className="mt-1.5 text-xs text-muted-foreground italic">{item.notes}</p>
            ) : null}
          </div>

          {/* ── Right actions ── */}
          <div className="flex flex-col items-center gap-0.5 shrink-0 pt-1.5">
            {/* Comments button */}
            <button
              onClick={() => setCommentsOpen(true)}
              className={cn(
                'relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
                commentsCount > 0
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:bg-muted',
              )}
              aria-label={`Comentários${commentsCount > 0 ? ` (${commentsCount})` : ''}`}
            >
              <MessageCircle className="w-4 h-4" />
              {commentsCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {commentsCount > 9 ? '9+' : commentsCount}
                </span>
              )}
            </button>

            {/* Camera */}
            {onPhotoChange && !disabled && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-lg transition-colors',
                  item.photo_url
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted',
                )}
                aria-label="Adicionar foto"
              >
                <Camera className="w-4 h-4" />
              </button>
            )}

            {/* ⋮ menu (mobile) / desktop shows inline buttons */}
            {!disabled && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted transition-colors sm:hidden"
                  aria-label="Mais ações"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-8 z-50 bg-card border border-border rounded-xl shadow-lg min-w-[160px] py-1 overflow-hidden">
                      <button
                        onClick={() => { setMenuOpen(false); setAssignOpen(true) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left"
                      >
                        <User className="w-4 h-4 text-muted-foreground" />
                        {localAssigned ? 'Reatribuir' : 'Atribuir'}
                      </button>
                      <button
                        onClick={() => { setMenuOpen(false); setDeadlineOpen(true) }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left"
                      >
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {localDueAt ? 'Alterar prazo' : 'Definir prazo'}
                      </button>
                    </div>
                  </>
                )}

                {/* Desktop inline buttons */}
                <div className="hidden sm:flex flex-col gap-0.5">
                  <button
                    onClick={() => setAssignOpen(true)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                    aria-label="Atribuir responsável"
                  >
                    <User className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeadlineOpen(true)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                    aria-label="Definir prazo"
                  >
                    <Calendar className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
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

      {/* Popovers */}
      <ItemAssignPopover
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        currentUser={localAssigned}
        onAssign={handleAssign}
      />
      <ItemDeadlinePopover
        open={deadlineOpen}
        onClose={() => setDeadlineOpen(false)}
        currentDueAt={localDueAt}
        onSetDeadline={handleSetDeadline}
      />
      <ItemCommentsSheet
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        itemId={item.id}
        itemDescription={item.description}
        checklistId={checklistId}
        onCommentsCount={setCommentsCount}
      />
    </>
  )
}
