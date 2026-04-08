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
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import { useQueryClient } from '@tanstack/react-query'
import { Zap, Wrench, Shield, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KanbanCard, KanbanCardContent } from './kanban-card'
import {
  useMaintenanceOrders,
  useChangeMaintenanceStatus,
  useCompleteMaintenanceOrder,
  type MaintenanceFilters,
} from '@/hooks/use-maintenance'
import { useUnitStore } from '@/stores/unit-store'
import type { MaintenanceForList, MaintenanceStatus } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// COLUMN DEFINITIONS
// ─────────────────────────────────────────────────────────────
const COLUMNS: {
  id: MaintenanceStatus
  label: string
  icon: React.ElementType
  barColor: string
  headerBg: string
  tintHover: string
}[] = [
  {
    id: 'open',
    label: 'Abertas',
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
    id: 'waiting_parts',
    label: 'Aguard. Peças',
    icon: Clock,
    barColor: 'bg-purple-500',
    headerBg: 'bg-purple-50 dark:bg-purple-950/30',
    tintHover: 'group-data-[over=true]:bg-purple-50/50 dark:group-data-[over=true]:bg-purple-950/20',
  },
  {
    id: 'completed',
    label: 'Concluídas',
    icon: Shield,
    barColor: 'bg-green-500',
    headerBg: 'bg-green-50 dark:bg-green-950/30',
    tintHover: 'group-data-[over=true]:bg-green-50/50 dark:group-data-[over=true]:bg-green-950/20',
  },
]

// ─────────────────────────────────────────────────────────────
// COLUMN COMPONENT
// ─────────────────────────────────────────────────────────────
function KanbanColumn({
  col,
  orders,
  isOver,
}: {
  col: typeof COLUMNS[number]
  orders: MaintenanceForList[]
  isOver: boolean
}) {
  const { setNodeRef } = useDroppable({ id: col.id })
  const Icon = col.icon

  return (
    <div
      ref={setNodeRef}
      data-over={isOver}
      className={cn(
        'group flex flex-col min-w-[280px] w-[280px] rounded-xl border border-border',
        'transition-colors duration-150',
        col.tintHover,
        isOver && 'border-border-strong ring-1 ring-border',
      )}
    >
      {/* Column header */}
      <div className={cn('px-3 py-2.5 rounded-t-xl border-b border-border', col.headerBg)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Colored bar accent */}
            <div className={cn('w-1 h-4 rounded-full', col.barColor)} />
            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">{col.label}</span>
          </div>
          <span className={cn(
            'text-xs font-medium tabular-nums px-1.5 py-0.5 rounded-full',
            orders.length > 0 ? 'bg-muted text-foreground' : 'text-muted-foreground',
          )}>
            {orders.length}
          </span>
        </div>
      </div>

      {/* Cards list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-320px)]">
        {orders.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground/50">
            Sem ordens
          </div>
        ) : (
          orders.map((order) => (
            <KanbanCard key={order.id} order={order} />
          ))
        )}
        {/* Drop target padding at bottom */}
        <div className="h-2" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// KANBAN BOARD
// ─────────────────────────────────────────────────────────────
interface KanbanBoardProps {
  filters: Pick<MaintenanceFilters, 'search' | 'type' | 'priority' | 'sectorId'>
}

export function KanbanBoard({ filters }: KanbanBoardProps) {
  const qc = useQueryClient()
  const { activeUnitId } = useUnitStore()
  const changeStatus  = useChangeMaintenanceStatus()
  const completeOrder = useCompleteMaintenanceOrder()

  const [activeOrder, setActiveOrder] = useState<MaintenanceForList | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  // Fetch all active statuses at once (no pagination for kanban)
  // useMemo ensures a stable reference so the query key doesn't change on every render
  const boardFilters = useMemo<MaintenanceFilters>(() => ({
    ...filters,
    status: ['open', 'in_progress', 'waiting_parts', 'completed'],
    pageSize: 300,
    page: 1,
  }), [filters])

  const { data } = useMaintenanceOrders(boardFilters)
  const allOrders = data?.data ?? []

  // Split into columns
  const columns = useMemo(() => {
    const map: Record<string, MaintenanceForList[]> = {
      open: [],
      in_progress: [],
      waiting_parts: [],
      completed: [],
    }
    for (const o of allOrders) {
      if (o.status in map) map[o.status].push(o)
    }
    return map
  }, [allOrders])

  // DnD sensors — require 8px movement to start drag (avoids click conflicts)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 5 } }),
  )

  function handleDragStart(event: DragStartEvent) {
    const order = allOrders.find((o) => o.id === event.active.id)
    if (order) setActiveOrder(order)
  }

  function handleDragOver(event: { over: { id?: string | number } | null }) {
    setOverId(event.over ? String(event.over.id) : null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveOrder(null)
    setOverId(null)

    const orderId = String(event.active.id)
    const newStatus = event.over?.id ? String(event.over.id) as MaintenanceStatus : null

    if (!newStatus) return

    const order = allOrders.find((o) => o.id === orderId)
    if (!order || order.status === newStatus) return

    // Optimistic update
    const queryKey = ['maintenance', boardFilters, activeUnitId]
    const snapshot = qc.getQueryData(queryKey)

    qc.setQueryData(queryKey, (old: typeof data) => {
      if (!old) return old
      return {
        ...old,
        data: old.data.map((o) =>
          o.id === orderId ? { ...o, status: newStatus } : o
        ),
      }
    })

    // Mutation
    const onError = () => {
      qc.setQueryData(queryKey, snapshot)
    }

    if (newStatus === 'completed') {
      completeOrder.mutate(orderId, { onError })
    } else {
      changeStatus.mutate({ id: orderId, status: newStatus }, { onError })
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver as any}
      onDragEnd={handleDragEnd}
    >
      {/* Horizontal scroll wrapper */}
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
        {COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            col={col}
            orders={columns[col.id] ?? []}
            isOver={overId === col.id}
          />
        ))}
      </div>

      {/* Drag overlay — portaled to document.body to avoid scroll/transform offset bugs */}
      {createPortal(
        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease-out' }}>
          {activeOrder ? (
            <div className="w-[264px]">
              <KanbanCardContent order={activeOrder} shadow />
            </div>
          ) : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}
