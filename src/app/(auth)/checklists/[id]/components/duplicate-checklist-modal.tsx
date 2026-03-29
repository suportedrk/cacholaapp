'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Copy, X, CalendarDays } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useEvents } from '@/hooks/use-events'
import { useUsers } from '@/hooks/use-users'
import { useDuplicateChecklist } from '@/hooks/use-checklists'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import type { ChecklistWithItems } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────
interface DuplicateChecklistModalProps {
  open:       boolean
  onClose:    () => void
  checklist:  ChecklistWithItems
  onDuplicated?: (newId: string) => void
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export function DuplicateChecklistModal({
  open,
  onClose,
  checklist,
  onDuplicated,
}: DuplicateChecklistModalProps) {
  const { profile } = useAuth()
  const { mutate: duplicate, isPending } = useDuplicateChecklist()

  // ── Form state ─────────────────────────────────────────────
  const [title,          setTitle]          = useState('')
  const [eventSearch,    setEventSearch]    = useState('')
  const [eventId,        setEventId]        = useState('')
  const [eventLabel,     setEventLabel]     = useState('')
  const [assignedTo,     setAssignedTo]     = useState('')
  const [dueDate,        setDueDate]        = useState('')
  const [copyPriorities, setCopyPriorities] = useState(true)
  const [copyAssignees,  setCopyAssignees]  = useState(false)
  const [copyDeadlines,  setCopyDeadlines]  = useState(false)
  const [showDropdown,   setShowDropdown]   = useState(false)

  const debouncedSearch = useDebounce(eventSearch, 300)

  const { data: eventsData } = useEvents({ search: debouncedSearch || undefined, pageSize: 20 })
  const { data: users = [] } = useUsers({ isActive: true })
  const eventsList = eventsData?.events ?? []

  // Reset on open
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return
    setTitle(`${checklist.title} (cópia)`)
    setEventSearch('')
    setEventId(checklist.event_id ?? '')
    setEventLabel(checklist.event?.title ?? '')
    setAssignedTo(checklist.assigned_to ?? '')
    setDueDate('')
    setCopyPriorities(true)
    setCopyAssignees(false)
    setCopyDeadlines(false)
    setShowDropdown(false)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const itemCount = checklist.checklist_items?.length ?? 0

  function selectEvent(ev: { id: string; title: string }) {
    setEventId(ev.id)
    setEventLabel(ev.title)
    setEventSearch(ev.title)
    setShowDropdown(false)
  }

  function clearEvent() {
    setEventId('')
    setEventLabel('')
    setEventSearch('')
    setShowDropdown(false)
  }

  function handleSubmit() {
    if (!title.trim()) return
    duplicate(
      {
        sourceChecklistId: checklist.id,
        targetEventId:     eventId || undefined,
        newTitle:          title.trim(),
        newAssignedTo:     assignedTo || undefined,
        newDueDate:        dueDate || undefined,
        createdBy:         profile?.id,
        copyPriorities,
        copyAssignees,
        copyDeadlines,
      },
      {
        onSuccess: (newId) => {
          onClose()
          onDuplicated?.(newId)
        },
      },
    )
  }

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className={cn(
        'relative bg-card border border-border w-full max-h-[90svh] overflow-y-auto',
        'sm:max-w-md sm:rounded-2xl rounded-t-2xl animate-scale-in',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Copy className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Duplicar Checklist</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Source info */}
          <div className="rounded-lg bg-muted/60 px-3 py-2.5">
            <p className="text-sm font-medium truncate">{checklist.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {itemCount} {itemCount !== 1 ? 'itens serão copiados' : 'item será copiado'} (sem preenchimento)
            </p>
          </div>

          {/* Novo título */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Novo título *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título do checklist duplicado"
              className="w-full h-10 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Vincular a evento */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Vincular a evento
            </label>
            <div className="relative">
              <div className="relative flex items-center">
                <CalendarDays className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={eventSearch}
                  onChange={(e) => {
                    setEventSearch(e.target.value)
                    setEventLabel('')
                    setEventId('')
                    setShowDropdown(true)
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Buscar evento… (opcional)"
                  className="w-full h-10 pl-9 pr-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {eventId && (
                  <button
                    onClick={clearEvent}
                    className="absolute right-3 text-muted-foreground hover:text-foreground"
                    aria-label="Limpar seleção"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Dropdown */}
              {showDropdown && eventSearch && (
                <div className="absolute z-10 w-full mt-1 max-h-44 overflow-y-auto bg-background border border-border rounded-lg shadow-md divide-y divide-border">
                  {eventsList.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum evento encontrado</p>
                  ) : (
                    eventsList.map((ev) => (
                      <button
                        key={ev.id}
                        onMouseDown={(e) => { e.preventDefault(); selectEvent(ev) }}
                        className="w-full px-3 py-2 text-xs text-left hover:bg-muted/60 transition-colors flex items-center gap-2"
                      >
                        <CalendarDays className="w-3 h-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{ev.title}</span>
                        {ev.date && (
                          <span className="ml-auto text-muted-foreground shrink-0">
                            {format(parseISO(ev.date), 'd MMM', { locale: ptBR })}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            {eventId && eventLabel && (
              <p className="text-xs text-green-600 dark:text-green-400">
                ✓ {eventLabel}
              </p>
            )}
          </div>

          {/* Responsável */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Responsável
            </label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Nenhum</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.id === checklist.assigned_to ? `Manter: ${u.name}` : u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Prazo */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Prazo
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-10 px-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Opções de cópia */}
          <div className="space-y-2.5 border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Opções de cópia
            </p>
            {(
              [
                { label: 'Copiar prioridades dos itens',           value: copyPriorities, setter: setCopyPriorities },
                { label: 'Copiar responsáveis dos itens',          value: copyAssignees,  setter: setCopyAssignees },
                { label: 'Copiar prazos dos itens (recalcular)',   value: copyDeadlines,  setter: setCopyDeadlines },
              ] as const
            ).map(({ label, value, setter }) => (
              <label key={label} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => (setter as (v: boolean) => void)(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary"
                />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
          <Button variant="ghost" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || isPending} className="gap-2">
            <Copy className="w-4 h-4" />
            {isPending ? 'Duplicando…' : 'Duplicar'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
