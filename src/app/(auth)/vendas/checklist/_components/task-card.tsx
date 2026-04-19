'use client'

import { cn } from '@/lib/utils'
import { formatDistanceToNow, isPast, isToday, isTomorrow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CheckSquare, Clock, User } from 'lucide-react'
import type { CommercialTask } from '@/hooks/commercial-checklist/use-commercial-tasks'

interface TaskCardProps {
  task:          CommercialTask
  showAssignee?: boolean
  onComplete?:   (task: CommercialTask) => void
  onClick?:      (task: CommercialTask) => void
}

const PRIORITY_CHIP: Record<string, string> = {
  low:    'badge-brand border',
  medium: 'badge-amber border',
  high:   'badge-red border',
}

const PRIORITY_LABEL: Record<string, string> = {
  low:    'Baixa',
  medium: 'Média',
  high:   'Alta',
}

const STATUS_LABEL: Record<string, string> = {
  pending:     'Pendente',
  in_progress: 'Em andamento',
  completed:   'Concluída',
  cancelled:   'Cancelada',
}

function dueDateLabel(dueDateStr: string | null): { label: string; isOverdue: boolean } {
  if (!dueDateStr) return { label: 'Sem prazo', isOverdue: false }

  const date = parseISO(dueDateStr)
  const isOverdue = isPast(date) && !isToday(date)

  if (isToday(date))    return { label: 'Hoje',   isOverdue: false }
  if (isTomorrow(date)) return { label: 'Amanhã', isOverdue: false }
  if (isOverdue) {
    return {
      label: `Há ${formatDistanceToNow(date, { locale: ptBR })}`,
      isOverdue: true,
    }
  }
  return {
    label: `Em ${formatDistanceToNow(date, { locale: ptBR, addSuffix: false })}`,
    isOverdue: false,
  }
}

export function TaskCard({ task, showAssignee, onComplete, onClick }: TaskCardProps) {
  const { label: dueLabel, isOverdue } = dueDateLabel(task.due_date)
  const isActive = task.status !== 'completed' && task.status !== 'cancelled'
  const isLongOverdue = isOverdue && task.due_date
    ? Math.abs(new Date().getTime() - parseISO(task.due_date).getTime()) > 3 * 24 * 60 * 60 * 1000
    : false

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 rounded-lg border bg-card p-4',
        isActive && 'card-interactive cursor-pointer',
        isOverdue && 'border-red-200',
        isLongOverdue && 'animate-pulse-subtle',
      )}
      onClick={() => onClick?.(task)}
    >
      {/* Checkbox de conclusão */}
      {isActive && onComplete && (
        <button
          onClick={(e) => { e.stopPropagation(); onComplete(task) }}
          className="mt-0.5 shrink-0 w-11 h-11 -ml-2 -mt-2 flex items-center justify-center rounded-md text-text-secondary hover:text-brand-600 transition-colors"
          aria-label="Marcar como concluída"
        >
          <CheckSquare className="h-5 w-5" />
        </button>
      )}

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            'font-medium text-sm text-text-primary leading-snug',
            task.status === 'completed' && 'line-through text-text-tertiary',
          )}>
            {task.title}
          </p>

          {/* Chip de prioridade */}
          {task.priority && (
            <span className={cn(
              'shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
              PRIORITY_CHIP[task.priority],
            )}>
              {PRIORITY_LABEL[task.priority]}
            </span>
          )}
        </div>

        {/* Metadados */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
          {/* Prazo */}
          <span className={cn(
            'flex items-center gap-1',
            isOverdue && 'text-status-error-text font-medium',
          )}>
            <Clock className="h-3.5 w-3.5" />
            {dueLabel}
          </span>

          {/* Assignee (visão de gestor) */}
          {showAssignee && task.assignee_name && (
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {task.assignee_name}
            </span>
          )}

          {/* Status quando não é pendente */}
          {task.status !== 'pending' && (
            <span className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border',
              task.status === 'in_progress' && 'badge-blue border',
              task.status === 'completed'   && 'badge-green border',
              task.status === 'cancelled'   && 'badge-gray border',
            )}>
              {STATUS_LABEL[task.status]}
            </span>
          )}
        </div>

        {/* Notas (preview truncado) */}
        {task.notes && (
          <p className="mt-1.5 text-xs text-text-tertiary line-clamp-2">{task.notes}</p>
        )}
      </div>
    </div>
  )
}
