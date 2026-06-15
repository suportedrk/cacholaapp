'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Globe, AlertTriangle, ListTodo, ExternalLink, Circle, CheckCircle2, Clock } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { UnitChip } from '@/components/shared/unit-chip'
import { useMyMeetingTasks, useSetMyActionItemStatus } from '@/hooks/use-my-meeting-tasks'
import type { MyMeetingTask } from '@/hooks/use-my-meeting-tasks'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { ROUTES } from '@/lib/constants'
import { ACTION_ITEM_STATUS_LABELS } from '@/types/minutes'
import { cn } from '@/lib/utils'
import { formatSaoPauloDateTimeShort } from '@/lib/utils/meeting-datetime'

// Chave de dia no fuso de São Paulo, para comparar com due_date (DATE SQL)
const dayKeyFmt = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo',
})

function todayKeySP(): string {
  return dayKeyFmt.format(new Date())
}

const STATUS_BADGE: Record<string, string> = {
  pending:     'badge-amber border',
  in_progress: 'badge-blue border',
  done:        'badge-green border',
}

// ── Cartão individual de tarefa ───────────────────────────────

function TaskCard({ task, isOverdue }: { task: MyMeetingTask; isOverdue: boolean }) {
  const { mutate: setStatus, isPending } = useSetMyActionItemStatus()
  const isDone = task.status === 'done'

  function toggle() {
    setStatus({ itemId: task.item_id, status: isDone ? 'pending' : 'done' })
  }

  return (
    <div className={cn(
      'rounded-xl border bg-card p-4 space-y-3 transition-colors',
      isOverdue && !isDone ? 'border-status-error-border' : 'border-border',
    )}>
      {/* Linha 1 — badge de status + checkbox de conclusão */}
      <div className="flex items-start gap-3">
        <button
          onClick={toggle}
          disabled={isPending}
          aria-label={isDone ? 'Reabrir tarefa' : 'Marcar como concluída'}
          className="mt-0.5 shrink-0 text-text-secondary hover:text-primary disabled:opacity-50 transition-colors"
        >
          {isDone
            ? <CheckCircle2 className="w-5 h-5 text-status-success-text" />
            : <Circle className="w-5 h-5" />
          }
        </button>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              'inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-full',
              STATUS_BADGE[task.status] ?? 'badge-gray border',
            )}>
              {ACTION_ITEM_STATUS_LABELS[task.status] ?? task.status}
            </span>
            {isOverdue && !isDone && (
              <span className="inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-full bg-status-error-bg text-status-error-text border border-status-error-border">
                Atrasada
              </span>
            )}
          </div>

          {/* Descrição */}
          <p className={cn('text-sm font-medium', isDone ? 'text-text-tertiary line-through' : 'text-text-primary')}>
            {task.description}
          </p>

          {/* Prazo */}
          {task.due_date && (
            <p className={cn(
              'text-xs flex items-center gap-1',
              isOverdue && !isDone ? 'text-status-error-text font-medium' : 'text-text-secondary',
            )}>
              <Clock className="w-3 h-3 shrink-0" />
              Prazo: {task.due_date}
            </p>
          )}
        </div>
      </div>

      {/* Linha 2 — contexto da ata */}
      <div className="pl-8 space-y-1.5">
        <p className="text-xs text-text-secondary">
          <span className="font-medium text-text-primary">{task.meeting_title}</span>
          {' · '}
          {formatSaoPauloDateTimeShort(task.meeting_date)}
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          {task.unit_id != null ? (
            <UnitChip slug={task.unit_slug} name={task.unit_name} size="sm" />
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
              <Globe className="w-3 h-3 shrink-0" />
              Geral
            </span>
          )}

          {task.can_view_full && (
            <Link
              href={`${ROUTES.minutes}/${task.meeting_id}`}
              className="inline-flex items-center gap-1 text-xs text-text-link hover:underline"
            >
              Abrir ata
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Grupo de tarefas ──────────────────────────────────────────

function Group({
  title,
  tasks,
  tone,
  isOverdue = false,
}: {
  title: string
  tasks: MyMeetingTask[]
  tone?: 'danger'
  isOverdue?: boolean
}) {
  if (tasks.length === 0) return null
  return (
    <section className="space-y-2">
      <h2 className={cn(
        'text-sm font-semibold',
        tone === 'danger' ? 'text-status-error-text' : 'text-text-primary',
      )}>
        {title}{' '}
        <span className="text-text-tertiary font-normal">({tasks.length})</span>
      </h2>
      <div className="space-y-2">
        {tasks.map((t) => (
          <TaskCard key={t.item_id} task={t} isOverdue={isOverdue} />
        ))}
      </div>
    </section>
  )
}

// ── Página principal ──────────────────────────────────────────

export default function AtasMinhasTarefasPage() {
  const { data: tasks = [], isLoading, isError, refetch } = useMyMeetingTasks()
  const { isTimedOut, retry } = useLoadingTimeout(isLoading)
  const showError = isError || isTimedOut

  const { overdue, todo, done } = useMemo(() => {
    const todayKey = todayKeySP()
    const overdue: MyMeetingTask[] = []
    const todo: MyMeetingTask[] = []
    const done: MyMeetingTask[] = []

    for (const t of tasks) {
      if (t.status === 'done') {
        done.push(t)
      } else if (t.due_date != null && t.due_date < todayKey) {
        overdue.push(t)
      } else {
        todo.push(t)
      }
    }
    return { overdue, todo, done }
  }, [tasks])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minhas Tarefas"
        description="Itens de ação das atas de reunião atribuídos a você."
      />

      {showError ? (
        <div className="rounded-xl border border-status-error-border bg-status-error-bg p-6 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 mx-auto text-status-error-text" />
          <p className="text-sm text-status-error-text">Não foi possível carregar suas tarefas.</p>
          <Button variant="outline" size="sm" onClick={() => { retry(); refetch() }}>
            Tentar novamente
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton-shimmer h-24 rounded-xl" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center space-y-3">
          <ListTodo className="w-10 h-10 mx-auto text-text-tertiary" />
          <p className="text-sm text-text-secondary">Você não tem tarefas de atas de reunião.</p>
          <p className="text-xs text-text-tertiary">
            Quando alguém criar uma ata e atribuir um item de ação a você, ele aparece aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <Group title="Atrasadas" tasks={overdue} tone="danger" isOverdue />
          <Group title="A fazer"   tasks={todo} />
          <Group title="Concluídas" tasks={done} />
        </div>
      )}
    </div>
  )
}
