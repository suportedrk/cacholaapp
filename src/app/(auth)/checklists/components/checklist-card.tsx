'use client'

import { memo } from 'react'
import Link from 'next/link'
import {
  format, isPast, parseISO, formatDistanceToNow, isToday, isTomorrow,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AlertTriangle, RefreshCw, CalendarDays,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { ProgressRing } from '@/components/ui/progress-ring'
import { UserAvatar } from '@/components/shared/user-avatar'
import { calcProgress } from '@/components/features/checklists/checklist-progress'
import { cn } from '@/lib/utils'
import type { ChecklistForList, ChecklistStatus, ChecklistType, Priority } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// BADGE CONFIGS
// ─────────────────────────────────────────────────────────────
const STATUS_BADGE: Record<ChecklistStatus, string> = {
  pending:     'badge-amber border',
  in_progress: 'badge-blue border',
  completed:   'badge-green border',
  cancelled:   'badge-gray border',
}

const STATUS_LABEL: Record<ChecklistStatus, string> = {
  pending:     'Pendente',
  in_progress: 'Em Andamento',
  completed:   'Concluído',
  cancelled:   'Cancelado',
}

const TYPE_BADGE: Record<ChecklistType, string> = {
  event:      'badge-blue border',
  standalone: 'badge-gray border',
  recurring:  'badge-purple border',
}

const TYPE_LABEL: Record<ChecklistType, string> = {
  event:      'Evento',
  standalone: 'Avulso',
  recurring:  'Recorrente',
}

const PRIORITY_BADGE: Record<Priority, string> = {
  low:    'badge-green border',
  medium: 'badge-amber border',
  high:   'badge-orange border',
  urgent: 'badge-red border',
}

const PRIORITY_LABEL: Record<Priority, string> = {
  low:    'Baixa',
  medium: 'Média',
  high:   'Alta',
  urgent: 'Urgente',
}

// ─────────────────────────────────────────────────────────────
// DEADLINE LABEL
// ─────────────────────────────────────────────────────────────
function deadlineLabel(dateStr: string, isOverdue: boolean): string {
  const d = parseISO(dateStr)
  if (isOverdue) {
    return `Atrasado ${formatDistanceToNow(d, { locale: ptBR, addSuffix: false })}`
  }
  if (isToday(d)) return 'Hoje'
  if (isTomorrow(d)) return 'Amanhã'
  return format(d, "d MMM", { locale: ptBR })
}

// ─────────────────────────────────────────────────────────────
// CHECKLIST CARD (redesign premium)
// ─────────────────────────────────────────────────────────────
interface ChecklistCardProps {
  checklist: ChecklistForList
}

export const ChecklistCard = memo(function ChecklistCard({ checklist }: ChecklistCardProps) {
  const { done, total, pct } = calcProgress(checklist.checklist_items)
  const isActive = checklist.status !== 'completed' && checklist.status !== 'cancelled'
  const isOverdue = isActive && !!checklist.due_date && isPast(parseISO(checklist.due_date))
  const hasRecurrence = checklist.type === 'recurring'

  const isCancelledCard = checklist.status === 'cancelled'

  return (
    <Link
      href={`/checklists/${checklist.id}`}
      className={cn(
        'group block bg-card border rounded-xl p-4 card-interactive',
        isOverdue
          ? 'border-red-200 dark:border-red-900/40'
          : 'border-border',
        isCancelledCard && 'opacity-60',
      )}
    >
      {/* ── Top row: ring + title + status ── */}
      <div className="flex items-start gap-3">
        {/* Progress ring */}
        <div className="shrink-0 mt-0.5">
          <ProgressRing pct={pct} size={40} strokeWidth={3.5} />
        </div>

        {/* Title & event */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {isOverdue && (
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
            )}
            {hasRecurrence && (
              <RefreshCw className="w-3 h-3 text-purple-500 shrink-0" aria-label="Recorrente" />
            )}
            <p className={cn(
              'text-sm font-semibold truncate',
              checklist.status === 'cancelled' && 'line-through text-muted-foreground',
            )}>
              {checklist.title}
            </p>
          </div>

          {checklist.event && (
            <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
              <CalendarDays className="w-3 h-3 shrink-0" />
              {checklist.event.title}
              {checklist.event.date && (
                <span className="opacity-70">
                  · {format(parseISO(checklist.event.date), 'd MMM', { locale: ptBR })}
                </span>
              )}
            </p>
          )}
        </div>

        {/* Status badge */}
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full shrink-0',
            STATUS_BADGE[checklist.status],
          )}
        >
          {STATUS_LABEL[checklist.status]}
        </span>
      </div>

      {/* ── Progress bar + count ── */}
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{done}/{total} itens</span>
          <span className="font-medium text-foreground">{pct}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-primary' : 'bg-amber-400',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* ── Bottom row: badges + assignee + deadline ── */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {/* Type badge */}
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 text-xs rounded-full',
            isCancelledCard ? 'badge-gray border' : TYPE_BADGE[checklist.type],
          )}
        >
          {TYPE_LABEL[checklist.type]}
        </span>

        {/* Priority badge — só mostrar se não for 'medium' para evitar ruído */}
        {checklist.priority !== 'medium' && (
          <span
            className={cn(
              'inline-flex items-center px-2 py-0.5 text-xs rounded-full',
              isCancelledCard ? 'badge-gray border' : PRIORITY_BADGE[checklist.priority],
            )}
          >
            {PRIORITY_LABEL[checklist.priority]}
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Assigned user */}
        {checklist.assigned_user && (
          <div className="flex items-center gap-1">
            <UserAvatar
              name={checklist.assigned_user.name}
              avatarUrl={checklist.assigned_user.avatar_url}
              size="sm"
            />
            <span className="text-xs text-muted-foreground hidden sm:block">
              {checklist.assigned_user.name.split(' ')[0]}
            </span>
          </div>
        )}

        {/* Deadline */}
        {checklist.due_date && isActive && (
          <span
            className={cn(
              'text-xs font-medium',
              isOverdue ? 'text-red-500' : 'text-muted-foreground',
            )}
          >
            {deadlineLabel(checklist.due_date, isOverdue)}
          </span>
        )}
      </div>
    </Link>
  )
})

// ─────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────
export function ChecklistCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="w-10 h-10 rounded-full shrink-0 skeleton-shimmer" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-3/4 skeleton-shimmer" />
          <Skeleton className="h-3 w-1/2 skeleton-shimmer" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full shrink-0 skeleton-shimmer" />
      </div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-16 skeleton-shimmer" />
          <Skeleton className="h-3 w-8 skeleton-shimmer" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full skeleton-shimmer" />
      </div>
      <div className="flex gap-2 items-center">
        <Skeleton className="h-5 w-16 rounded-full skeleton-shimmer" />
        <Skeleton className="h-5 w-12 rounded-full skeleton-shimmer" />
        <div className="flex-1" />
        <Skeleton className="w-7 h-7 rounded-full skeleton-shimmer" />
        <Skeleton className="h-3 w-14 skeleton-shimmer" />
      </div>
    </div>
  )
}
