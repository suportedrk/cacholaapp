'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { format, subDays, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Calendar, ChevronDown, ChevronUp, ClipboardList,
  RefreshCw, Search, Camera,
} from 'lucide-react'
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  useCreateChecklist,
  useChecklistTemplates,
} from '@/hooks/use-checklists'
import { useEvents } from '@/hooks/use-events'
import { useUsers } from '@/hooks/use-users'
import { useAuth } from '@/hooks/use-auth'
import {
  PRIORITY_LABELS,
  type ChecklistType,
  type Priority,
  type TemplateWithItems,
} from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const TYPE_OPTIONS: { value: ChecklistType; label: string; icon: React.ReactNode }[] = [
  { value: 'event',      label: 'Evento',     icon: <Calendar className="w-4 h-4" /> },
  { value: 'standalone', label: 'Avulso',     icon: <ClipboardList className="w-4 h-4" /> },
  { value: 'recurring',  label: 'Recorrente', icon: <RefreshCw className="w-4 h-4" /> },
]

const PRIORITY_OPTIONS: Priority[] = ['urgent', 'high', 'medium', 'low']

const PRIORITY_DOT: Record<Priority, string> = {
  urgent: 'bg-red-500',
  high:   'bg-orange-500',
  medium: 'bg-amber-400',
  low:    'bg-green-500',
}

// ─────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────
interface CreateChecklistModalProps {
  open: boolean
  onClose: () => void
  defaultEventId?: string
  defaultEventTitle?: string
  onCreated?: (checklistId: string) => void
}

// ─────────────────────────────────────────────────────────────
// TEMPLATE ITEMS PREVIEW
// ─────────────────────────────────────────────────────────────
function TemplateItemsPreview({ template }: { template: TemplateWithItems }) {
  const [collapsed, setCollapsed] = useState(template.template_items.length > 5)
  const items = collapsed
    ? template.template_items.slice(0, 5)
    : template.template_items

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <ClipboardList className="w-3.5 h-3.5" />
          {template.template_items.length} iten{template.template_items.length !== 1 ? 's' : ''} do template
        </p>
        {template.template_items.length > 5 && (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
          >
            {collapsed ? (
              <><ChevronDown className="w-3 h-3" /> Ver todos</>
            ) : (
              <><ChevronUp className="w-3 h-3" /> Recolher</>
            )}
          </button>
        )}
      </div>

      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-xs text-foreground">
            <span className="w-3 h-3 rounded-sm border border-border shrink-0" />
            <span className="flex-1 truncate">{item.description}</span>
            <span className={cn('w-2 h-2 rounded-full shrink-0', PRIORITY_DOT[item.default_priority ?? 'medium'])} />
            {item.requires_photo && <Camera className="w-3 h-3 text-muted-foreground shrink-0" />}
          </li>
        ))}
        {collapsed && template.template_items.length > 5 && (
          <li className="text-xs text-muted-foreground pl-5">
            + {template.template_items.length - 5} mais...
          </li>
        )}
      </ul>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export function CreateChecklistModal({
  open,
  onClose,
  defaultEventId,
  defaultEventTitle,
  onCreated,
}: CreateChecklistModalProps) {
  const { user } = useAuth()

  // ── Form state ──
  const [type, setType]                       = useState<ChecklistType>('event')
  const [templateId, setTemplateId]           = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateWithItems | null>(null)
  const [eventSearch, setEventSearch]         = useState('')
  const [eventId, setEventId]                 = useState(defaultEventId ?? '')
  const [showEventDrop, setShowEventDrop]     = useState(false)
  const [title, setTitle]                     = useState('')
  const [titleEdited, setTitleEdited]         = useState(false)
  const [description, setDescription]         = useState('')
  const [priority, setPriority]               = useState<Priority>('medium')
  const [dueDate, setDueDate]                 = useState('')
  const [assignedTo, setAssignedTo]           = useState('')
  const [errors, setErrors]                   = useState<Record<string, string>>({})
  const eventDropRef = useRef<HTMLDivElement>(null)

  // ── Data ──
  const { data: templates = [], isLoading: templatesLoading } = useChecklistTemplates(true)
  const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd')
  const { data: eventsData } = useEvents({
    search: eventSearch || undefined,
    dateFrom: sevenDaysAgo,
    pageSize: 30,
  })
  const events = (eventsData?.events ?? []).filter(
    (e) => e.status !== 'lost'
  )
  const { data: usersData = [] } = useUsers({ isActive: true })
  const createChecklist = useCreateChecklist()

  // ── Template groups by category ──
  const templatesByCategory = useMemo(() => {
    const map = new Map<string, TemplateWithItems[]>()
    for (const t of templates) {
      const cat = t.category?.name ?? 'Sem categoria'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(t)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [templates])

  // ── Selected event info ──
  const selectedEvent = defaultEventId
    ? { id: defaultEventId, title: defaultEventTitle ?? '', date: '' }
    : events.find((e) => e.id === eventId) ?? null

  // ── Auto-fill title ──
  useEffect(() => {
    if (titleEdited) return
    if (selectedTemplate && type === 'event' && selectedEvent?.title) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(`${selectedTemplate.title} — ${selectedEvent.title}`)
    } else if (selectedTemplate) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(selectedTemplate.title)
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle('')
    }
  }, [selectedTemplate, selectedEvent?.title, type, titleEdited])

  // ── Auto-fill priority from template ──
  useEffect(() => {
    if (selectedTemplate?.default_priority) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPriority(selectedTemplate.default_priority)
    }
  }, [selectedTemplate])

  // ── Close event dropdown on outside click ──
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (eventDropRef.current && !eventDropRef.current.contains(e.target as Node)) {
        setShowEventDrop(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  // ── Reset ──
  const reset = useCallback(() => {
    setType('event')
    setTemplateId(null)
    setSelectedTemplate(null)
    setEventSearch('')
    setEventId(defaultEventId ?? '')
    setShowEventDrop(false)
    setTitle('')
    setTitleEdited(false)
    setDescription('')
    setPriority('medium')
    setDueDate('')
    setAssignedTo('')
    setErrors({})
  }, [defaultEventId])

  function handleClose() {
    reset()
    onClose()
  }

  function handleSelectTemplate(tpl: TemplateWithItems | null) {
    setTemplateId(tpl?.id ?? null)
    setSelectedTemplate(tpl)
    setTitleEdited(false)
  }

  function handleSelectEvent(ev: { id: string; title: string; date: string }) {
    setEventId(ev.id)
    setEventSearch(ev.title)
    setShowEventDrop(false)
    setErrors((e) => ({ ...e, eventId: '' }))
  }

  // ── Validate ──
  function validate() {
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = 'Título é obrigatório.'
    if (type === 'event' && !defaultEventId && !eventId) {
      errs.eventId = 'Selecione um evento.'
    }
    return errs
  }

  // ── Submit ──
  async function handleCreate() {
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }

    const id = await createChecklist.mutateAsync({
      title: title.trim(),
      type,
      templateId:  templateId ?? undefined,
      eventId:     type === 'event' ? (defaultEventId || eventId || undefined) : undefined,
      description: description.trim() || undefined,
      priority,
      dueDate:     dueDate || undefined,
      assignedTo:  assignedTo || undefined,
      createdBy:   user?.id,
    })

    onCreated?.(id)
    handleClose()
  }

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          // Base
          'p-0 gap-0 overflow-hidden flex flex-col',
          // Desktop
          'sm:max-w-xl sm:max-h-[90svh]',
          // Mobile — bottom-sheet
          'max-sm:!top-auto max-sm:!bottom-0 max-sm:!left-0 max-sm:!right-0',
          'max-sm:!translate-x-0 max-sm:!translate-y-0',
          'max-sm:!max-w-full max-sm:w-full',
          'max-sm:rounded-t-2xl max-sm:rounded-b-none max-sm:!max-h-[90svh]',
        )}
      >
        {/* ── Header ── */}
        <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
          {/* Drag handle (mobile) */}
          <div className="mx-auto w-10 h-1 bg-muted-foreground/30 rounded-full mb-3 sm:hidden" />

          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-semibold">Novo Checklist</DialogTitle>
            <button
              type="button"
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground transition-colors rounded-md p-1 hover:bg-muted"
              aria-label="Fechar"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

          {/* ─── Tipo ─── */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Tipo <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TYPE_OPTIONS.map(({ value, label, icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setType(value); setErrors({}) }}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border-2 px-2 py-3 text-xs font-medium transition-all',
                    type === value
                      ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20'
                      : 'border-border text-muted-foreground hover:border-border-strong hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ─── Recorrente: aviso ─── */}
          {type === 'recurring' && (
            <div className="rounded-lg bg-purple-50 border border-purple-200 dark:bg-purple-950/20 dark:border-purple-800 p-3">
              <p className="text-xs text-purple-700 dark:text-purple-300">
                <RefreshCw className="w-3.5 h-3.5 inline mr-1" />
                Configure a recorrência após criar o checklist. O checklist será criado como avulso com tipo recorrente.
              </p>
            </div>
          )}

          {/* ─── Template selector ─── */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Template</Label>
            {templatesLoading ? (
              <div className="space-y-1">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-lg" />)}
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                {/* Opção: sem template */}
                <button
                  type="button"
                  onClick={() => handleSelectTemplate(null)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm transition-colors',
                    templateId === null
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                >
                  Criar do zero (sem template)
                </button>

                {templatesByCategory.map(([cat, tpls]) => (
                  <div key={cat}>
                    <p className="px-3 py-1 text-xs text-muted-foreground bg-muted/30 border-t border-border uppercase tracking-wide">
                      {cat}
                    </p>
                    {tpls.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => handleSelectTemplate(tpl)}
                        className={cn(
                          'w-full text-left px-3 py-2.5 text-sm transition-colors border-t border-border/40',
                          templateId === tpl.id
                            ? 'bg-primary/10 text-primary dark:bg-primary/20'
                            : 'text-foreground hover:bg-muted/50',
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">{tpl.title}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {tpl.default_priority && tpl.default_priority !== 'medium' && (
                              <span className={cn('w-2 h-2 rounded-full', PRIORITY_DOT[tpl.default_priority])} />
                            )}
                            <span className="text-xs text-muted-foreground">
                              {tpl.template_items.length} it.
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ))}

                {templatesByCategory.length === 0 && (
                  <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                    Nenhum template disponível. Crie um em Templates.
                  </p>
                )}
              </div>
            )}

            {/* Preview dos itens do template */}
            {selectedTemplate && (
              <TemplateItemsPreview template={selectedTemplate} />
            )}
          </div>

          {/* ─── Evento (apenas quando type === 'event') ─── */}
          {type === 'event' && (
            <div className="space-y-1.5">
              <Label htmlFor="cl-event" className="text-sm font-medium">
                Evento <span className="text-red-500">*</span>
              </Label>

              {defaultEventId ? (
                /* Pré-selecionado e bloqueado */
                <div className="h-10 px-3 rounded-lg border border-border bg-muted/50 flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{defaultEventTitle}</span>
                  <span className="ml-auto text-xs text-muted-foreground">fixo</span>
                </div>
              ) : (
                /* Combobox com busca */
                <div className="relative" ref={eventDropRef}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      id="cl-event"
                      type="text"
                      value={eventSearch}
                      onChange={(e) => {
                        setEventSearch(e.target.value)
                        setEventId('')
                        setShowEventDrop(true)
                      }}
                      onFocus={() => setShowEventDrop(true)}
                      placeholder="Buscar evento…"
                      className={cn(
                        'w-full h-10 pl-9 pr-3 rounded-lg border bg-background text-sm',
                        'placeholder:text-muted-foreground',
                        'focus:outline-none focus:ring-2 focus:ring-ring transition-colors',
                        errors.eventId ? 'border-red-400' : 'border-border hover:border-border-strong',
                      )}
                    />
                  </div>

                  {showEventDrop && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-md max-h-48 overflow-y-auto">
                      {events.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-muted-foreground text-center">
                          Nenhum evento encontrado.
                        </p>
                      ) : (
                        events.map((ev) => (
                          <button
                            key={ev.id}
                            type="button"
                            onMouseDown={() => handleSelectEvent({ id: ev.id, title: ev.title, date: ev.date })}
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors border-b border-border/40 last:border-0"
                          >
                            <p className="font-medium truncate">{ev.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(parseISO(ev.date), "d 'de' MMMM", { locale: ptBR })}
                              {ev.client_name && ` · ${ev.client_name}`}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
              {errors.eventId && <p className="text-xs text-red-500">{errors.eventId}</p>}
            </div>
          )}

          {/* ─── Título ─── */}
          <div className="space-y-1.5">
            <Label htmlFor="cl-title" className="text-sm font-medium">
              Título <span className="text-red-500">*</span>
            </Label>
            <Input
              id="cl-title"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleEdited(true); setErrors((er) => ({ ...er, title: '' })) }}
              onBlur={() => { if (!title.trim()) setErrors((er) => ({ ...er, title: 'Título é obrigatório.' })) }}
              placeholder="Nome do checklist…"
              className={cn('h-10', errors.title && 'border-red-400 focus-visible:ring-red-400')}
            />
            {errors.title && <p className="text-xs text-red-500">{errors.title}</p>}
          </div>

          {/* ─── Descrição ─── */}
          <div className="space-y-1.5">
            <Label htmlFor="cl-desc" className="text-sm font-medium">Descrição</Label>
            <textarea
              id="cl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição opcional…"
              rows={2}
              className={cn(
                'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm',
                'placeholder:text-muted-foreground resize-none',
                'focus:outline-none focus:ring-2 focus:ring-ring transition-colors',
                'hover:border-border-strong',
              )}
            />
          </div>

          {/* ─── Prioridade + Prazo ─── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cl-priority" className="text-sm font-medium">Prioridade</Label>
              <Select value={priority} onValueChange={(v) => v && setPriority(v as Priority)}>
                <SelectTrigger className="h-10">
                  <span data-slot="select-value" className="flex flex-1 text-left">
                    {PRIORITY_LABELS[priority]}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cl-due" className="text-sm font-medium">
                Prazo{type === 'standalone' && <span className="text-red-500"> *</span>}
              </Label>
              <Input
                id="cl-due"
                type="datetime-local"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-10 text-sm"
              />
            </div>
          </div>

          {/* ─── Responsável ─── */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Responsável</Label>
            <Select value={assignedTo || null} onValueChange={(v) => setAssignedTo(v ?? '')}>
              <SelectTrigger className="h-10">
                {assignedTo
                  ? <span data-slot="select-value" className="flex flex-1 text-left">{usersData.find((u) => u.id === assignedTo)?.name ?? assignedTo}</span>
                  : <SelectValue placeholder="Sem responsável" />}
              </SelectTrigger>
              <SelectContent>
                {usersData.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          className="border-t border-border bg-muted/50 px-4 py-3 flex justify-end gap-2 shrink-0"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <Button variant="outline" size="sm" onClick={handleClose} disabled={createChecklist.isPending}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={createChecklist.isPending}
          >
            {createChecklist.isPending ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5" />
                Criando…
              </>
            ) : (
              'Criar checklist'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
