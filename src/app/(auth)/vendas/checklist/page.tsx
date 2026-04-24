'use client'

import { useState } from 'react'
import { Plus, ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMyCommercialTasks } from '@/hooks/commercial-checklist/use-commercial-tasks'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { TaskCard } from './_components/task-card'
import { TaskCompleteDialog } from './_components/task-complete-dialog'
import { NewTaskModal } from './_components/new-task-modal'
import { MyTaskFilterPills, type MyFilter } from './_components/task-filters'
import type { CommercialTask } from '@/hooks/commercial-checklist/use-commercial-tasks'

export default function MinhasTarefasPage() {
  return <MinhasTarefasContent />
}

function MinhasTarefasContent() {
  const [filter,           setFilter]           = useState<MyFilter>('today')
  const [completingTask,   setCompletingTask]   = useState<CommercialTask | null>(null)
  const [newTaskOpen,      setNewTaskOpen]       = useState(false)

  const { data, isLoading, isError, refetch } = useMyCommercialTasks(filter)
  const { isTimedOut, retry } = useLoadingTimeout(isLoading)

  const tasks = data ?? []

  // Counts for pill badges (all filters use same query, so we count client-side)
  const now    = new Date()
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  const overdueCutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const counts: Partial<Record<MyFilter, number>> = {
    today:       (data?.filter((t) => t.due_date && new Date(t.due_date) <= todayEnd) ?? []).length,
    overdue:     (data?.filter((t) => t.due_date && new Date(t.due_date) < overdueCutoff) ?? []).length,
    upcoming_7d: (data?.filter((t) => {
      if (!t.due_date) return false
      const d = new Date(t.due_date)
      return d >= overdueCutoff && d <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    }) ?? []).length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="icon-brand rounded-md p-2">
            <ClipboardCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Minhas Tarefas</h1>
            <p className="text-sm text-text-secondary">Checklist comercial pessoal</p>
          </div>
        </div>

        <Button size="sm" onClick={() => setNewTaskOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nova tarefa
        </Button>
      </div>

      {/* Filter pills */}
      <MyTaskFilterPills value={filter} onChange={setFilter} counts={counts} />

      {/* Content */}
      {(isLoading && !isTimedOut) && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg skeleton-shimmer" />
          ))}
        </div>
      )}

      {(isError || isTimedOut) && (
        <div className="rounded-lg border border-status-error-bg bg-status-error-bg/40 p-4 flex items-center justify-between">
          <p className="text-sm text-status-error-text">Erro ao carregar tarefas.</p>
          <Button variant="outline" size="sm" onClick={() => { retry(); refetch() }}>
            Tentar novamente
          </Button>
        </div>
      )}

      {!isLoading && !isError && tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ClipboardCheck className="h-10 w-10 text-text-tertiary mb-3" />
          <p className="text-text-secondary font-medium">
            {filter === 'today'       ? 'Nenhuma tarefa para hoje'
            : filter === 'overdue'    ? 'Nenhuma tarefa atrasada'
            : filter === 'upcoming_7d'? 'Nenhuma tarefa nos próximos 7 dias'
            : 'Nenhuma tarefa encontrada'}
          </p>
          <p className="text-text-tertiary text-sm mt-1">
            Crie uma tarefa avulsa ou peça ao gestor para aplicar um template.
          </p>
        </div>
      )}

      {!isLoading && !isError && tasks.length > 0 && (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={(t) => setCompletingTask(t)}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <TaskCompleteDialog
        task={completingTask}
        onClose={() => setCompletingTask(null)}
      />
      <NewTaskModal open={newTaskOpen} onClose={() => setNewTaskOpen(false)} />
    </div>
  )
}
