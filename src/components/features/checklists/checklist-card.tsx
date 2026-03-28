import { memo } from 'react'
import Link from 'next/link'
import { format, isPast, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar, Clock, User, AlertTriangle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { ChecklistProgress, calcProgress } from './checklist-progress'
import type { ChecklistForList, ChecklistStatus } from '@/types/database.types'

const STATUS_LABEL: Record<ChecklistStatus, string> = {
  pending:     'Pendente',
  in_progress: 'Em Andamento',
  completed:   'Concluído',
  cancelled:   'Cancelado',
}

const STATUS_CLASS: Record<ChecklistStatus, string> = {
  pending:     'badge-amber',
  in_progress: 'badge-blue',
  completed:   'badge-green',
  cancelled:   'badge-gray',
}

interface ChecklistCardProps {
  checklist: ChecklistForList
}

export const ChecklistCard = memo(function ChecklistCard({ checklist }: ChecklistCardProps) {
  const { done, total } = calcProgress(checklist.checklist_items)
  const isOverdue = checklist.due_date
    && checklist.status !== 'completed'
    && checklist.status !== 'cancelled'
    && isPast(parseISO(checklist.due_date))

  return (
    <Link
      href={`/checklists/${checklist.id}`}
      className={cn(
        'block bg-card border rounded-xl p-4 space-y-3 transition-shadow hover:shadow-md',
        isOverdue ? 'border-destructive/40 bg-destructive/5' : 'border-border'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-2 justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {isOverdue && (
              <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
            )}
            <p className="text-sm font-semibold text-foreground truncate">
              {checklist.title}
            </p>
          </div>
          {checklist.event && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {checklist.event.title}
            </p>
          )}
        </div>
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border shrink-0',
            STATUS_CLASS[checklist.status],
          )}
        >
          {STATUS_LABEL[checklist.status]}
        </span>
      </div>

      {/* Progresso */}
      <ChecklistProgress items={checklist.checklist_items} size="sm" />

      {/* Footer */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {checklist.event?.date && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {format(parseISO(checklist.event.date), "d MMM", { locale: ptBR })}
          </span>
        )}
        {checklist.due_date && (
          <span className={cn('flex items-center gap-1', isOverdue && 'text-destructive font-medium')}>
            <Clock className="w-3 h-3" />
            {isOverdue ? 'Atrasado — ' : ''}
            {format(parseISO(checklist.due_date), "d MMM HH:mm", { locale: ptBR })}
          </span>
        )}
        {checklist.assigned_user && (
          <span className="flex items-center gap-1 ml-auto">
            <User className="w-3 h-3" />
            {checklist.assigned_user.name.split(' ')[0]}
          </span>
        )}
        <span className="ml-auto text-foreground font-medium">
          {done}/{total}
        </span>
      </div>
    </Link>
  )
})

export function ChecklistCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3 animate-pulse">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex gap-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}
