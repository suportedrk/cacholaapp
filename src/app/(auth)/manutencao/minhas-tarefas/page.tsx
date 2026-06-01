'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Clock, AlertTriangle, ListTodo, ExternalLink } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { Button } from '@/components/ui/button'
import { useMyMaintenanceTasks, type MyMaintenanceTask } from '@/hooks/use-my-maintenance-tasks'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { ROUTES } from '@/lib/constants'
import { cn } from '@/lib/utils'

// Dia/hora sempre em Brasília (fecha o ciclo do timezone).
const dayKeyFmt = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Sao_Paulo',
})
const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo',
})

const STATUS_BADGE: Record<string, string> = {
  assigned:    'badge-amber border',
  in_progress: 'badge-blue border',
  concluded:   'badge-green border',
}
const STATUS_LABEL: Record<string, string> = {
  assigned: 'Atribuída', in_progress: 'Em andamento', concluded: 'Concluída',
}

function todayKeyBrasilia(): string {
  return dayKeyFmt.format(new Date())
}

function TaskCard({ task }: { task: MyMaintenanceTask }) {
  return (
    <Link
      href={`${ROUTES.maintenanceChamados}/${task.ticket_id}`}
      className="block rounded-xl border border-border bg-card p-4 hover:border-border-strong transition-colors card-interactive"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-full', STATUS_BADGE[task.status] ?? 'badge-gray border')}>
              {STATUS_LABEL[task.status] ?? task.status}
            </span>
            <span className="inline-flex items-center text-xs font-medium px-1.5 py-0.5 rounded-full badge-gray border">
              {task.role === 'executor' ? 'Executor' : 'Responsável'}
            </span>
          </div>
          <p className="text-sm font-medium text-text-primary truncate">{task.ticket_title}</p>
          <p className="text-xs text-text-secondary flex items-center gap-1.5">
            <Clock className="w-3 h-3 shrink-0" />
            {dateTimeFmt.format(new Date(task.scheduled_at))}
            {task.estimated_duration_minutes ? ` · ${task.estimated_duration_minutes} min` : ''}
          </p>
        </div>
        <ExternalLink className="w-4 h-4 text-text-tertiary shrink-0" />
      </div>
    </Link>
  )
}

function Group({ title, tasks, tone }: { title: string; tasks: MyMaintenanceTask[]; tone?: 'danger' }) {
  if (tasks.length === 0) return null
  return (
    <section className="space-y-2">
      <h2 className={cn('text-sm font-semibold', tone === 'danger' ? 'text-status-error-text' : 'text-text-primary')}>
        {title} <span className="text-text-tertiary font-normal">({tasks.length})</span>
      </h2>
      <div className="space-y-2">
        {tasks.map((t) => <TaskCard key={t.id} task={t} />)}
      </div>
    </section>
  )
}

export default function MinhasTarefasManutencaoPage() {
  const { data: tasks = [], isLoading, isError, refetch } = useMyMaintenanceTasks()
  const { isTimedOut, retry } = useLoadingTimeout(isLoading)
  const showError = isError || isTimedOut

  const { overdue, today, upcoming } = useMemo(() => {
    const todayKey = todayKeyBrasilia()
    const overdue: MyMaintenanceTask[] = []
    const today: MyMaintenanceTask[] = []
    const upcoming: MyMaintenanceTask[] = []
    for (const t of tasks) {
      const key = dayKeyFmt.format(new Date(t.scheduled_at))
      if (key < todayKey) overdue.push(t)
      else if (key === todayKey) today.push(t)
      else upcoming.push(t)
    }
    return { overdue, today, upcoming }
  }, [tasks])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minhas tarefas de manutenção"
        description="Execuções de manutenção agendadas para você (como executor ou responsável)."
      />

      {showError ? (
        <div className="rounded-xl border border-status-error-border bg-status-error-bg p-6 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 mx-auto text-status-error-text" />
          <p className="text-sm text-status-error-text">Não foi possível carregar suas tarefas.</p>
          <Button variant="outline" size="sm" onClick={() => { retry(); refetch() }}>Tentar novamente</Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton-shimmer h-20 rounded-xl" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-12 text-center space-y-3">
          <ListTodo className="w-10 h-10 mx-auto text-text-tertiary" />
          <p className="text-sm text-text-secondary">Você não tem execuções de manutenção agendadas.</p>
          <p className="text-xs text-text-tertiary">Quando alguém agendar uma execução para você, ela aparece aqui.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <Group title="Atrasadas" tasks={overdue} tone="danger" />
          <Group title="Hoje" tasks={today} />
          <Group title="Próximas" tasks={upcoming} />
        </div>
      )}
    </div>
  )
}
