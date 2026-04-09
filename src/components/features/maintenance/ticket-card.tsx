'use client'

import { memo } from 'react'
import { format, isPast, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useRouter } from 'next/navigation'
import {
  MapPin, Tag, Calendar, Layers, AlertTriangle,
  Clock, CheckCircle2, XCircle, Wrench, MoreVertical,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUpdateTicketStatus } from '@/hooks/use-tickets'
import type { MaintenanceTicketForList, TicketStatus } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// BADGE CONFIGS
// ─────────────────────────────────────────────────────────────
export const URGENCY_CONFIG: Record<string, { label: string; badge: string }> = {
  critical: { label: 'Crítico',  badge: 'badge-red border'    },
  high:     { label: 'Alto',     badge: 'badge-orange border' },
  medium:   { label: 'Médio',    badge: 'badge-amber border'  },
  low:      { label: 'Baixo',    badge: 'badge-green border'  },
}

export const NATURE_CONFIG: Record<string, { label: string; badge: string; borderLeft: string }> = {
  emergencial: { label: 'Emergencial', badge: 'badge-red border',    borderLeft: 'border-l-red-400'    },
  pontual:     { label: 'Pontual',     badge: 'badge-blue border',   borderLeft: 'border-l-blue-400'   },
  agendado:    { label: 'Agendado',    badge: 'badge-purple border', borderLeft: 'border-l-purple-400' },
  preventivo:  { label: 'Preventivo',  badge: 'badge-teal border',   borderLeft: 'border-l-teal-400'   },
}

export const STATUS_CONFIG: Record<TicketStatus, { label: string; badge: string; icon: React.ElementType }> = {
  open:         { label: 'Aberto',           badge: 'badge-gray border',   icon: Clock        },
  in_progress:  { label: 'Em andamento',     badge: 'badge-blue border',   icon: Wrench       },
  waiting_part: { label: 'Aguard. peça',     badge: 'badge-amber border',  icon: AlertTriangle },
  concluded:    { label: 'Concluído',        badge: 'badge-green border',  icon: CheckCircle2 },
  cancelled:    { label: 'Cancelado',        badge: 'badge-gray border',   icon: XCircle      },
}

const STATUS_TRANSITIONS: Partial<Record<TicketStatus, TicketStatus[]>> = {
  open:         ['in_progress', 'waiting_part', 'concluded', 'cancelled'],
  in_progress:  ['waiting_part', 'concluded', 'cancelled'],
  waiting_part: ['in_progress', 'concluded', 'cancelled'],
}

// ─────────────────────────────────────────────────────────────
// TICKET CARD
// ─────────────────────────────────────────────────────────────
interface TicketCardProps {
  ticket: MaintenanceTicketForList
  onClick?: () => void
}

export const TicketCard = memo(function TicketCard({ ticket, onClick }: TicketCardProps) {
  const router        = useRouter()
  const updateStatus  = useUpdateTicketStatus()

  const urgency   = URGENCY_CONFIG[ticket.urgency]   ?? URGENCY_CONFIG.medium
  const nature    = NATURE_CONFIG[ticket.nature]     ?? NATURE_CONFIG.pontual
  const statusCfg = STATUS_CONFIG[ticket.status]     ?? STATUS_CONFIG.open
  const StatusIcon = statusCfg.icon

  const isOverdue = !!(
    ticket.due_at &&
    ticket.status !== 'concluded' &&
    ticket.status !== 'cancelled' &&
    isPast(parseISO(ticket.due_at))
  )

  const isConcluded = ticket.status === 'concluded'
  const execCount   = Array.isArray((ticket as any).executions) ? (ticket as any).executions.length : 0

  const nextStatuses = STATUS_TRANSITIONS[ticket.status] ?? []

  function handleNavigate() {
    if (onClick) { onClick(); return }
    router.push(`/manutencao/chamados/${ticket.id}`)
  }

  return (
    <article
      onClick={handleNavigate}
      className={cn(
        'bg-card rounded-xl border overflow-hidden cursor-pointer card-interactive',
        'border-l-[3px]',
        nature.borderLeft,
        isOverdue && 'border-t-red-200 border-r-red-200 border-b-red-200 bg-red-50/30 dark:border-t-red-900/30 dark:border-r-red-900/30 dark:border-b-red-900/30 dark:bg-red-950/10',
        isConcluded && 'opacity-70',
      )}
    >
      <div className="p-4 space-y-3">
        {/* Row 1 — urgency + nature + menu */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', urgency.badge)}>
              {urgency.label}
            </span>
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', nature.badge)}>
              {nature.label}
            </span>
          </div>

          {/* Menu — stop propagation to avoid card navigation */}
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <MoreVertical className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleNavigate}>
                  <ExternalLink className="w-3.5 h-3.5 mr-2" />
                  Ver detalhes
                </DropdownMenuItem>
                {nextStatuses.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    {nextStatuses.map((st) => {
                      const cfg = STATUS_CONFIG[st]
                      const Ic  = cfg.icon
                      return (
                        <DropdownMenuItem
                          key={st}
                          onClick={() => updateStatus.mutate({ id: ticket.id, status: st })}
                        >
                          <Ic className="w-3.5 h-3.5 mr-2" />
                          {cfg.label}
                        </DropdownMenuItem>
                      )
                    })}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Row 2 — title */}
        <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
          {ticket.title}
        </h3>

        {/* Row 3 — sector + category */}
        <div className="flex items-center gap-3 text-xs text-text-secondary flex-wrap">
          {ticket.sector && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              {ticket.sector.name}
            </span>
          )}
          {ticket.category && (
            <span className="inline-flex items-center gap-1">
              <Tag className="w-3 h-3 shrink-0" />
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ background: ticket.category.color ?? '#888' }}
              />
              {ticket.category.name}
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-border" />

        {/* Row 4 — status + date info */}
        <div className="flex items-center justify-between gap-2">
          <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', statusCfg.badge)}>
            <StatusIcon className="w-3 h-3" />
            {statusCfg.label}
          </span>

          <div className="flex items-center gap-3 text-xs text-text-secondary">
            {/* Execution count */}
            {execCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {execCount}
              </span>
            )}

            {/* Due date or concluded date */}
            {isConcluded && ticket.concluded_at ? (
              <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3" />
                {format(parseISO(ticket.concluded_at), "d MMM", { locale: ptBR })}
              </span>
            ) : ticket.due_at ? (
              <span className={cn(
                'inline-flex items-center gap-1',
                isOverdue ? 'text-red-500 font-medium' : '',
              )}>
                <Calendar className="w-3 h-3" />
                {format(parseISO(ticket.due_at), "d MMM", { locale: ptBR })}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-text-tertiary">
                <Calendar className="w-3 h-3" />
                {format(parseISO(ticket.created_at), "d MMM", { locale: ptBR })}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  )
})

// ─────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────
export function TicketCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-l-[3px] border-l-border p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-5 w-16 skeleton-shimmer rounded-full" />
        <div className="h-5 w-20 skeleton-shimmer rounded-full" />
      </div>
      <div className="h-4 w-3/4 skeleton-shimmer rounded" />
      <div className="flex gap-3">
        <div className="h-3 w-24 skeleton-shimmer rounded" />
        <div className="h-3 w-20 skeleton-shimmer rounded" />
      </div>
      <div className="border-t border-border" />
      <div className="flex justify-between">
        <div className="h-5 w-28 skeleton-shimmer rounded-full" />
        <div className="h-3 w-16 skeleton-shimmer rounded" />
      </div>
    </div>
  )
}
