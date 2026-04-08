'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { format, isPast, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Calendar, User, ExternalLink, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/shared/user-avatar'
import { MAINTENANCE_TYPE_CONFIG } from './maintenance-type-badge'
import { MaintenancePriorityBadge } from './maintenance-status-badge'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useDeleteMaintenanceOrder } from '@/hooks/use-maintenance'
import type { MaintenanceForList } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// SLA BAR
// ─────────────────────────────────────────────────────────────
function calcSla(order: MaintenanceForList) {
  if (!order.due_date || order.status === 'completed' || order.status === 'cancelled') return null
  const created = new Date(order.created_at).getTime()
  const due     = parseISO(order.due_date + 'T23:59:59').getTime()
  const now     = Date.now()
  if (now > due) return { pct: 100, barColor: 'bg-red-500' }
  const total = due - created
  if (total <= 0) return null
  const pct = Math.min(100, Math.max(2, ((now - created) / total) * 100))
  const barColor = pct >= 85 ? 'bg-orange-400' : pct >= 65 ? 'bg-amber-400' : 'bg-primary'
  return { pct, barColor }
}

// ─────────────────────────────────────────────────────────────
// CARD CONTENT (pure visual — reused in DragOverlay)
// ─────────────────────────────────────────────────────────────
export function KanbanCardContent({
  order,
  shadow,
}: {
  order: MaintenanceForList
  shadow?: boolean
}) {
  const typeCfg = MAINTENANCE_TYPE_CONFIG[order.type] ?? MAINTENANCE_TYPE_CONFIG.punctual
  const sla     = calcSla(order)
  const isOverdue = !!(
    order.due_date &&
    order.status !== 'completed' &&
    order.status !== 'cancelled' &&
    isPast(parseISO(order.due_date))
  )
  const firstName = order.assigned_user?.name?.split(' ')[0] ?? null

  return (
    <article className={cn(
      'bg-card rounded-lg border overflow-hidden',
      'border-l-[3px]',
      typeCfg.borderLeft,
      isOverdue
        ? 'border-t-red-200 border-r-red-200 border-b-red-200 dark:border-t-red-900/40 dark:border-r-red-900/40 dark:border-b-red-900/40'
        : 'border-t-border border-r-border border-b-border',
      shadow && 'shadow-lg rotate-1 scale-[1.02]',
    )}>
      <div className="p-2.5 space-y-2">
        {/* Row 1: type pill + priority */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium',
            typeCfg.pill,
          )}>
            <span className={cn('w-1 h-1 rounded-full shrink-0', typeCfg.dot)} />
            {typeCfg.label}
          </span>
          <MaintenancePriorityBadge priority={order.priority} className="text-[10px] px-1.5 py-0.5" />
        </div>

        {/* Row 2: title */}
        <p className="text-xs font-semibold text-foreground leading-snug line-clamp-2">
          {order.title}
        </p>

        {/* Row 3: assignee + due date */}
        <div className="flex items-center justify-between gap-1.5">
          {order.assigned_user ? (
            <div className="flex items-center gap-1.5 min-w-0">
              <UserAvatar
                name={order.assigned_user.name}
                avatarUrl={order.assigned_user.avatar_url}
                size="sm"
                className="shrink-0"
              />
              <span className="text-[10px] text-muted-foreground truncate">{firstName}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
              <User className="w-3 h-3" />
              <span>—</span>
            </div>
          )}

          {order.due_date && (
            <span className={cn(
              'inline-flex items-center gap-0.5 text-[10px] shrink-0',
              isOverdue ? 'text-red-500 font-medium' : 'text-muted-foreground',
            )}>
              <Calendar className="w-2.5 h-2.5" />
              {format(parseISO(order.due_date), 'd MMM', { locale: ptBR })}
            </span>
          )}
        </div>
      </div>

      {/* SLA bar */}
      {sla && (
        <div className="h-[2px] w-full bg-border/30">
          <div
            className={cn('h-full', sla.barColor)}
            style={{ width: `${sla.pct}%` }}
          />
        </div>
      )}
    </article>
  )
}

// ─────────────────────────────────────────────────────────────
// DRAGGABLE CARD
// ─────────────────────────────────────────────────────────────
interface KanbanCardProps {
  order: MaintenanceForList
}

export function KanbanCard({ order }: KanbanCardProps) {
  const router    = useRouter()
  const deleteOrder = useDeleteMaintenanceOrder()

  const {
    setNodeRef,
    attributes,
    listeners,
    isDragging,
    transform,
  } = useDraggable({ id: order.id, data: { status: order.status } })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group cursor-grab active:cursor-grabbing touch-none',
        isDragging && 'opacity-30',
      )}
    >
      {/* Draggable layer — click navigates, drag moves */}
      <div
        {...listeners}
        {...attributes}
        onClick={() => router.push(`/manutencao/${order.id}`)}
        className="focus:outline-none"
      >
        <KanbanCardContent order={order} />
      </div>

      {/* Quick action menu — stops propagation so click doesn't navigate */}
      <div
        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            className="w-5 h-5 rounded flex items-center justify-center bg-card/80 backdrop-blur hover:bg-muted transition-colors"
          >
            <MoreHorizontal className="w-3 h-3 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => router.push(`/manutencao/${order.id}`)}>
              <ExternalLink className="w-3.5 h-3.5 mr-2" />
              Ver detalhes
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <ConfirmDialog
              title="Excluir ordem?"
              description="Esta ação não pode ser desfeita. A ordem e todas as fotos associadas serão removidas."
              onConfirm={() => deleteOrder.mutate(order.id)}
              confirmLabel="Excluir"
              destructive
              trigger={
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Excluir
                </DropdownMenuItem>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
