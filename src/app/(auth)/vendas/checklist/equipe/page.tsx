'use client'

import { useState, useMemo } from 'react'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTeamCommercialTasks, type TeamTaskFilters } from '@/hooks/commercial-checklist/use-commercial-tasks'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { TaskCard } from '../_components/task-card'
import { TeamTaskFiltersBar } from '../_components/task-filters'

export default function EquipeComercialPage() {
  return <EquipeComercialContent />
}

function EquipeComercialContent() {
  const [filters, setFilters] = useState<TeamTaskFilters>({})

  const { data, isLoading, isError, refetch } = useTeamCommercialTasks(filters)
  const { isTimedOut, retry } = useLoadingTimeout(isLoading)

  const tasks = data ?? []

  // Unique assignees from loaded data
  const assignees = useMemo(() => {
    const seen = new Map<string, string>()
    tasks.forEach((t) => {
      if (t.assignee_id && t.assignee_name) seen.set(t.assignee_id, t.assignee_name)
    })
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [tasks])

  // Group tasks by assignee
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; tasks: typeof tasks }>()
    tasks.forEach((t) => {
      const key  = t.assignee_id
      const name = t.assignee_name ?? 'Sem nome'
      if (!map.has(key)) map.set(key, { name, tasks: [] })
      map.get(key)!.tasks.push(t)
    })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [tasks])

  const pendingCount   = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length
  const overdueCount   = tasks.filter((t) => {
    if (!t.due_date || t.status === 'completed' || t.status === 'cancelled') return false
    return new Date(t.due_date) < new Date()
  }).length
  const completedCount = tasks.filter((t) => {
    if (t.status !== 'completed') return false
    const d = new Date(t.updated_at)
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
    return d >= weekAgo
  }).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="icon-brand rounded-md p-2">
          <Users className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Equipe Comercial</h1>
          <p className="text-sm text-text-secondary">
            {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
            {overdueCount > 0 && ` · ${overdueCount} atrasada${overdueCount !== 1 ? 's' : ''}`}
            {completedCount > 0 && ` · ${completedCount} concluída${completedCount !== 1 ? 's' : ''} esta semana`}
          </p>
        </div>
      </div>

      {/* Filters */}
      <TeamTaskFiltersBar
        filters={filters}
        onChange={setFilters}
        assignees={assignees}
      />

      {/* Loading */}
      {isLoading && !isTimedOut && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-lg skeleton-shimmer" />)}
        </div>
      )}

      {/* Error */}
      {(isError || isTimedOut) && (
        <div className="rounded-lg border border-status-error-bg bg-status-error-bg/40 p-4 flex items-center justify-between">
          <p className="text-sm text-status-error-text">Erro ao carregar tarefas.</p>
          <Button variant="outline" size="sm" onClick={() => { retry(); refetch() }}>
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !isError && tasks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Users className="h-10 w-10 text-text-tertiary mb-3" />
          <p className="text-text-secondary font-medium">Nenhuma tarefa encontrada</p>
          <p className="text-text-tertiary text-sm mt-1">
            Ajuste os filtros ou aplique um template para criar tarefas para a equipe.
          </p>
        </div>
      )}

      {/* Grouped by assignee */}
      {!isLoading && !isError && grouped.length > 0 && (
        <div className="space-y-8">
          {grouped.map(({ name, tasks: assigneeTasks }) => (
            <section key={name}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold text-text-primary">{name}</h2>
                <span className="text-xs text-text-tertiary bg-surface-secondary rounded-full px-2 py-0.5">
                  {assigneeTasks.length}
                </span>
              </div>
              <div className="space-y-2">
                {assigneeTasks.map((task) => (
                  <TaskCard key={task.id} task={task} showAssignee={false} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
