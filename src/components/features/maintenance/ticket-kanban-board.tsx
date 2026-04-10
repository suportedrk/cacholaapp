'use client'

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { MapPin, Zap, Wrench, Clock, CheckCircle2, MoreVertical } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTickets, useUpdateTicketStatus, type TicketFilters } from '@/hooks/use-tickets'
import { useUnitStore } from '@/stores/unit-store'
import { URGENCY_CONFIG, NATURE_CONFIG } from './ticket-card'
import type { MaintenanceTicketForList, TicketStatus } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// COLUMN DEFINITIONS
// ─────────────────────────────────────────────────────────────
const COLUMNS: {
  id: TicketStatus
  label: string
  icon: React.ElementType
  barColor: string
  headerBg: string
  tintHover: string
}[] = [
  {
    id: 'open',
    label: 'Aberto',
    icon: Zap,
    barColor: 'bg-primary',
    headerBg: 'bg-primary/10',
    tintHover: 'group-data-[over=true]:bg-primary/5',
  },
  {
    id: 'in_progress',
    label: 'Em Andamento',
    icon: Wrench,
    barColor: 'bg-amber-500',
    headerBg: 'bg-amber-50 dark:bg-amber-950/30',
    tintHover: 'group-data-[over=true]:bg-amber-50/50 dark:group-data-[over=true]:bg-amber-950/20',
  },
  {
    id: 'waiting_part',
    label: 'Aguard. Peça',
    icon: Clock,
    barColor: 'bg-purple-500',
    headerBg: 'bg-purple-50 dark:bg-purple-950/30',
    tintHover: 'group-data-[over=true]:bg-purple-50/50 dark:group-data-[over=true]:bg-purple-950/20',
  },
  {
    id: 'concluded',
    label: 'Concluído',
    icon: CheckCircle2,
    barColor: 'bg-green-500',
    headerBg: 'bg-green-50 dark:bg-green-950/30',
    tintHover: 'group-data-[over=true]:bg-green-50/50 dark:group-data-[over=true]:bg-green-950/20',
  },
]

// ─────────────────────────────────────────────────────────────
// KANBAN CARD CONTENT (pure visual — reused in DragOverlay)
// ─────────────────────────────────────────────────────────────
function TicketKanbanCardContent({
  ticket,
  shadow,
}: {
  ticket: MaintenanceTicketForList
  shadow?: boolean
}) {
  const urgency = URGENCY_CONFIG[ticket.urgency] ?? URGENCY_CONFIG.medium
  const nature  = NATURE_CONFIG[ticket.nature]   ?? NATURE_CONFIG.pontual

  return (
    <article className={cn(
      'bg-card rounded-lg border border-l-[3px] overflow-hidden text-left w-full',
      nature.borderLeft,
      'border-t-border border-r-border border-b-border',
      shadow && 'shadow-lg rotate-1 scale-[1.02]',
    )}>
      <div className="p-2.5 space-y-2">
        {/* Badges */}
        <div className="flex items-center gap-1 flex-wrap">
          <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium', urgency.badge)}>
            {urgency.label}
          </span>
          <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium', nature.badge)}>
            {nature.label}
          </span>
        </div>

        {/* Title */}
        <p className="text-xs font-semibold text-foreground leading-snug line-clamp-2">
          {ticket.title}
        </p>

        {/* Sector */}
        {ticket.sector && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <MapPin className="w-2.5 h-2.5 shrink-0" />
            {ticket.sector.name}
          </div>
        )}

        {/* Date */}
        {ticket.due_at && (
          <div className="text-[10px] text-muted-foreground">
            Prazo: {format(parseISO(ticket.due_at), "d MMM", { locale: ptBR })}
          </div>
        )}
      </div>
    </article>
  )
}

// ─────────────────────────────────────────────────────────────
// DRAGGABLE CARD
// ─────────────────────────────────────────────────────────────
function TicketKanbanCard({ ticket }: { ticket: MaintenanceTicketForList }) {
  const router = useRouter()
  const { setNodeRef, attributes, listeners, isDragging, transform } = useDraggable({
    id:   ticket.id,
    data: { status: ticket.status },
  })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group cursor-grab active:cursor-grabbing touch-none',
        isDragging && 'opacity-30',
      )}
    >
      <div
        {...listeners}
        {...attributes}
        onClick={() => router.push(`/manutencao/chamados/${ticket.id}`)}
        className="focus:outline-none"
      >
        <TicketKanbanCardContent ticket={ticket} />
      </div>

      {/* Quick menu */}
      <div
        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => router.push(`/manutencao/chamados/${ticket.id}`)}
          className="w-5 h-5 rounded flex items-center justify-center bg-card/80 backdrop-blur hover:bg-muted transition-colors"
        >
          <MoreVertical className="w-3 h-3 text-muted-foreground" />
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// KANBAN COLUMN
// ─────────────────────────────────────────────────────────────
function TicketKanbanColumn({
  col,
  tickets,
  isOver,
}: {
  col: typeof COLUMNS[number]
  tickets: MaintenanceTicketForList[]
  isOver: boolean
}) {
  const { setNodeRef } = useDroppable({ id: col.id })
  const Icon = col.icon

  return (
    <div
      ref={setNodeRef}
      data-over={isOver}
      className={cn(
        'group flex flex-col min-w-[272px] w-[272px] rounded-xl border border-border',
        'transition-colors duration-150',
        col.tintHover,
        isOver && 'border-border-strong ring-1 ring-border',
      )}
    >
      {/* Header */}
      <div className={cn('px-3 py-2.5 rounded-t-xl border-b border-border', col.headerBg)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('w-1 h-4 rounded-full', col.barColor)} />
            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">{col.label}</span>
          </div>
          <span className={cn(
            'text-xs font-medium tabular-nums px-1.5 py-0.5 rounded-full',
            tickets.length > 0 ? 'bg-muted text-foreground' : 'text-muted-foreground',
          )}>
            {tickets.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-320px)]">
        {tickets.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground/50">
            Sem chamados
          </div>
        ) : (
          tickets.map((t) => <TicketKanbanCard key={t.id} ticket={t} />)
        )}
        <div className="h-2" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TICKET KANBAN BOARD
// ─────────────────────────────────────────────────────────────
export interface TicketKanbanBoardProps {
  filters: Pick<TicketFilters, 'search' | 'nature' | 'urgency' | 'sectorId'>
}

export function TicketKanbanBoard({ filters }: TicketKanbanBoardProps) {
  const qc            = useQueryClient()
  const { activeUnitId } = useUnitStore()
  const updateStatus  = useUpdateTicketStatus()

  const [activeTicket, setActiveTicket] = useState<MaintenanceTicketForList | null>(null)
  const [overId, setOverId]             = useState<string | null>(null)

  // Fetch all statuses for kanban
  const boardFilters = useMemo<TicketFilters>(() => ({
    ...filters,
    status:   ['open', 'in_progress', 'waiting_part', 'concluded'],
    pageSize: 300,
  }), [filters])

  const { data: allTickets = [] } = useTickets(boardFilters)

  // Split into columns
  const columns = useMemo(() => {
    const map: Record<string, MaintenanceTicketForList[]> = {
      open: [], in_progress: [], waiting_part: [], concluded: [],
    }
    for (const t of allTickets) {
      if (t.status in map) map[t.status].push(t)
    }
    return map
  }, [allTickets])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  function handleDragStart(event: DragStartEvent) {
    const t = allTickets.find((x) => x.id === event.active.id)
    if (t) setActiveTicket(t)
  }

  function handleDragOver(event: { over: { id?: string | number } | null }) {
    setOverId(event.over ? String(event.over.id) : null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTicket(null)
    setOverId(null)

    const ticketId  = String(event.active.id)
    const newStatus = event.over?.id ? (String(event.over.id) as TicketStatus) : null
    if (!newStatus) return

    const ticket = allTickets.find((t) => t.id === ticketId)
    if (!ticket || ticket.status === newStatus) return

    // Optimistic update
    const queryKey = ['tickets', boardFilters, activeUnitId]
    const snapshot = qc.getQueryData(queryKey)

    qc.setQueryData(queryKey, (old: MaintenanceTicketForList[] | undefined) =>
      (old ?? []).map((t) => t.id === ticketId ? { ...t, status: newStatus } : t)
    )

    updateStatus.mutate(
      { id: ticketId, status: newStatus },
      { onError: () => qc.setQueryData(queryKey, snapshot) },
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver as any}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
        {COLUMNS.map((col) => (
          <TicketKanbanColumn
            key={col.id}
            col={col}
            tickets={columns[col.id] ?? []}
            isOver={overId === col.id}
          />
        ))}
      </div>

      {createPortal(
        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease-out' }}>
          {activeTicket ? (
            <div className="w-[256px]">
              <TicketKanbanCardContent ticket={activeTicket} shadow />
            </div>
          ) : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}
