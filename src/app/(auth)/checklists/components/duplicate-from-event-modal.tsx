'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Copy, X, CalendarDays, CheckSquare, Square, Loader2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useEvents } from '@/hooks/use-events'
import { useEventChecklists } from '@/hooks/use-checklists'
import { useUsers } from '@/hooks/use-users'
import { useDuplicateChecklist } from '@/hooks/use-checklists'
import { useAuth } from '@/hooks/use-auth'
import { useDebounce } from '@/hooks/use-debounce'
import type { ChecklistForList } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────
interface DuplicateFromEventModalProps {
  open: boolean
  onClose: () => void
  /** When provided, target event is pre-filled and locked */
  defaultTargetEventId?: string
  defaultTargetEventTitle?: string
  onDuplicated?: (ids: string[]) => void
}

// ─────────────────────────────────────────────────────────────
// CHECKLIST ITEM CARD
// ─────────────────────────────────────────────────────────────
function ChecklistItem({
  cl,
  selected,
  onToggle,
}: {
  cl: ChecklistForList
  selected: boolean
  onToggle: () => void
}) {
  const total = cl.checklist_items?.length ?? 0
  const done  = cl.checklist_items?.filter((i) => i.status === 'done').length ?? 0
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors',
        selected
          ? 'border-primary bg-primary/5 dark:bg-primary/10'
          : 'border-border hover:bg-muted/50',
      )}
    >
      {selected ? (
        <CheckSquare className="w-4 h-4 shrink-0 text-primary" />
      ) : (
        <Square className="w-4 h-4 shrink-0 text-muted-foreground" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{cl.title}</p>
        <p className="text-xs text-muted-foreground">
          {total} {total !== 1 ? 'itens' : 'item'} · {pct}% concluído
        </p>
      </div>
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export function DuplicateFromEventModal({
  open,
  onClose,
  defaultTargetEventId,
  defaultTargetEventTitle,
  onDuplicated,
}: DuplicateFromEventModalProps) {
  const { profile } = useAuth()
  const { mutateAsync: duplicate } = useDuplicateChecklist()

  // ── Source event ────────────────────────────────────────────
  const [srcSearch,    setSrcSearch]    = useState('')
  const [srcEventId,   setSrcEventId]   = useState('')
  const [srcEventLabel, setSrcEventLabel] = useState('')
  const [srcDropdown,  setSrcDropdown]  = useState(false)

  // ── Target event ────────────────────────────────────────────
  const [tgtSearch,    setTgtSearch]    = useState('')
  const [tgtEventId,   setTgtEventId]   = useState(defaultTargetEventId ?? '')
  const [tgtEventLabel, setTgtEventLabel] = useState(defaultTargetEventTitle ?? '')
  const [tgtDropdown,  setTgtDropdown]  = useState(false)
  const [standalone,   setStandalone]   = useState(false)

  // ── Other options ───────────────────────────────────────────
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set())
  const [assignedTo,     setAssignedTo]     = useState('')
  const [copyPriorities, setCopyPriorities] = useState(true)
  const [copyAssignees,  setCopyAssignees]  = useState(false)
  const [copyDeadlines,  setCopyDeadlines]  = useState(false)
  const [isPending,      setIsPending]      = useState(false)

  const debouncedSrc = useDebounce(srcSearch, 300)
  const debouncedTgt = useDebounce(tgtSearch, 300)

  const { data: srcEventsData } = useEvents({ search: debouncedSrc || undefined, pageSize: 20 })
  const { data: tgtEventsData } = useEvents({ search: debouncedTgt || undefined, pageSize: 20 })
  const { data: users = [] }    = useUsers({ isActive: true })
  const { data: checklists = [] } = useEventChecklists(srcEventId || null)

  const srcEvents = srcEventsData?.events ?? []
  const tgtEvents = tgtEventsData?.events ?? []

  // Reset on open
  useEffect(() => {
    if (!open) return
    setSrcSearch('')
    setSrcEventId('')
    setSrcEventLabel('')
    setSrcDropdown(false)
    setTgtSearch(defaultTargetEventTitle ?? '')
    setTgtEventId(defaultTargetEventId ?? '')
    setTgtEventLabel(defaultTargetEventTitle ?? '')
    setTgtDropdown(false)
    setStandalone(!defaultTargetEventId)
    setSelectedIds(new Set())
    setAssignedTo('')
    setCopyPriorities(true)
    setCopyAssignees(false)
    setCopyDeadlines(false)
    setIsPending(false)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectSrcEvent = useCallback((ev: { id: string; title: string }) => {
    setSrcEventId(ev.id)
    setSrcEventLabel(ev.title)
    setSrcSearch(ev.title)
    setSrcDropdown(false)
    setSelectedIds(new Set())
  }, [])

  const clearSrcEvent = useCallback(() => {
    setSrcEventId('')
    setSrcEventLabel('')
    setSrcSearch('')
    setSrcDropdown(false)
    setSelectedIds(new Set())
  }, [])

  const selectTgtEvent = useCallback((ev: { id: string; title: string }) => {
    setTgtEventId(ev.id)
    setTgtEventLabel(ev.title)
    setTgtSearch(ev.title)
    setTgtDropdown(false)
    setStandalone(false)
  }, [])

  const clearTgtEvent = useCallback(() => {
    setTgtEventId('')
    setTgtEventLabel('')
    setTgtSearch('')
    setTgtDropdown(false)
  }, [])

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === checklists.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(checklists.map((c) => c.id)))
    }
  }

  async function handleSubmit() {
    if (!srcEventId || selectedIds.size === 0) return
    setIsPending(true)
    const ids: string[] = []
    try {
      for (const checklistId of selectedIds) {
        const newId = await duplicate({
          sourceChecklistId: checklistId,
          targetEventId: standalone ? undefined : (tgtEventId || undefined),
          newAssignedTo: assignedTo || undefined,
          createdBy: profile?.id,
          copyPriorities,
          copyAssignees,
          copyDeadlines,
        })
        ids.push(newId)
      }
      toast.success(`${ids.length} checklist${ids.length !== 1 ? 's duplicados' : ' duplicado'} com sucesso`)
      onClose()
      onDuplicated?.(ids)
    } catch {
      toast.error('Erro ao duplicar checklists')
    } finally {
      setIsPending(false)
    }
  }

  if (!open) return null

  const allSelected = checklists.length > 0 && selectedIds.size === checklists.length
  const canSubmit   = !isPending && srcEventId && selectedIds.size > 0 && (standalone || tgtEventId)

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className={cn(
        'relative bg-card border border-border w-full max-h-[90svh] overflow-y-auto',
        'sm:max-w-lg sm:rounded-2xl rounded-t-2xl animate-scale-in',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Copy className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Duplicar de Evento Anterior</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* ── Source event ── */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Evento de origem *
            </label>
            <div className="relative">
              <div className="relative flex items-center">
                <CalendarDays className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  value={srcSearch}
                  onChange={(e) => {
                    setSrcSearch(e.target.value)
                    setSrcEventId('')
                    setSrcEventLabel('')
                    setSrcDropdown(true)
                    setSelectedIds(new Set())
                  }}
                  onFocus={() => setSrcDropdown(true)}
                  placeholder="Buscar evento de origem…"
                  className="w-full h-10 pl-9 pr-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                />
                {srcEventId && (
                  <button
                    onClick={clearSrcEvent}
                    className="absolute right-3 text-muted-foreground hover:text-foreground"
                    aria-label="Limpar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {srcDropdown && srcSearch && (
                <div className="absolute z-10 w-full mt-1 max-h-44 overflow-y-auto bg-background border border-border rounded-lg shadow-md divide-y divide-border">
                  {srcEvents.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum evento encontrado</p>
                  ) : (
                    srcEvents.map((ev) => (
                      <button
                        key={ev.id}
                        onMouseDown={(e) => { e.preventDefault(); selectSrcEvent(ev) }}
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
            {srcEventId && srcEventLabel && (
              <p className="text-xs text-green-600 dark:text-green-400">✓ {srcEventLabel}</p>
            )}
          </div>

          {/* ── Checklist multi-select ── */}
          {srcEventId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Checklists para duplicar *
                </label>
                {checklists.length > 1 && (
                  <button
                    onClick={toggleAll}
                    className="text-xs text-primary hover:underline"
                  >
                    {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                  </button>
                )}
              </div>
              {checklists.length === 0 ? (
                <p className="text-sm text-muted-foreground px-1">
                  Nenhum checklist encontrado nesse evento.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {checklists.map((cl) => (
                    <ChecklistItem
                      key={cl.id}
                      cl={cl}
                      selected={selectedIds.has(cl.id)}
                      onToggle={() => toggleSelect(cl.id)}
                    />
                  ))}
                </div>
              )}
              {selectedIds.size > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedIds.size} de {checklists.length} selecionado{selectedIds.size !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          {/* ── Target event ── */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Evento de destino
            </label>

            {/* Standalone toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={standalone}
                onChange={(e) => {
                  setStandalone(e.target.checked)
                  if (e.target.checked) {
                    setTgtEventId('')
                    setTgtEventLabel('')
                    setTgtSearch('')
                  }
                }}
                className="w-4 h-4 rounded border-border text-primary"
              />
              <span className="text-sm">Criar como checklists avulsos (sem evento)</span>
            </label>

            {!standalone && !defaultTargetEventId && (
              <div className="relative">
                <div className="relative flex items-center">
                  <CalendarDays className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={tgtSearch}
                    onChange={(e) => {
                      setTgtSearch(e.target.value)
                      setTgtEventId('')
                      setTgtEventLabel('')
                      setTgtDropdown(true)
                    }}
                    onFocus={() => setTgtDropdown(true)}
                    placeholder="Buscar evento de destino…"
                    className="w-full h-10 pl-9 pr-3 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {tgtEventId && (
                    <button
                      onClick={clearTgtEvent}
                      className="absolute right-3 text-muted-foreground hover:text-foreground"
                      aria-label="Limpar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {tgtDropdown && tgtSearch && (
                  <div className="absolute z-10 w-full mt-1 max-h-44 overflow-y-auto bg-background border border-border rounded-lg shadow-md divide-y divide-border">
                    {tgtEvents.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">Nenhum evento encontrado</p>
                    ) : (
                      tgtEvents.map((ev) => (
                        <button
                          key={ev.id}
                          onMouseDown={(e) => { e.preventDefault(); selectTgtEvent(ev) }}
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
                {tgtEventId && tgtEventLabel && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ {tgtEventLabel}</p>
                )}
              </div>
            )}

            {!standalone && defaultTargetEventId && (
              <p className="text-xs text-green-600 dark:text-green-400">✓ {defaultTargetEventTitle}</p>
            )}
          </div>

          {/* ── Assignee override ── */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Responsável (substitui o original)
            </label>
            <Select
              value={assignedTo || null}
              onValueChange={(v) => setAssignedTo(v ?? '')}
            >
              <SelectTrigger className="w-full">
                {assignedTo
                  ? <span data-slot="select-value" className="flex flex-1 text-left">{users.find((u) => u.id === assignedTo)?.name ?? 'Usuário'}</span>
                  : <SelectValue placeholder="Manter responsável original" />}
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ── Copy options ── */}
          <div className="space-y-2.5 border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Opções de cópia
            </p>
            {(
              [
                { label: 'Copiar prioridades dos itens',         value: copyPriorities, setter: setCopyPriorities },
                { label: 'Copiar responsáveis dos itens',        value: copyAssignees,  setter: setCopyAssignees },
                { label: 'Copiar prazos dos itens (recalcular)', value: copyDeadlines,  setter: setCopyDeadlines },
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
        <div className="flex items-center justify-between gap-3 p-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {selectedIds.size > 0
              ? `${selectedIds.size} checklist${selectedIds.size !== 1 ? 's' : ''} selecionado${selectedIds.size !== 1 ? 's' : ''}`
              : 'Selecione ao menos 1 checklist'}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="gap-2"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Duplicando…
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Duplicar {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
