'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, CheckCircle2, AlertTriangle, Clock, CalendarCheck,
  ListTodo, Search, X, CalendarDays,
} from 'lucide-react'
import {
  startOfDay, addDays, isBefore, parseISO, formatDistanceToNow, format, isToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { UserAvatar } from '@/components/shared/user-avatar'
import { useAuth } from '@/hooks/use-auth'
import { useMyTasks, useMyCompletedTasksCount, type MyTaskItem } from '@/hooks/use-my-tasks'
import { cn } from '@/lib/utils'
import { PRIORITY_LABELS } from '@/types/database.types'
import type { Priority } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// PRIORITY PILL
// ─────────────────────────────────────────────────────────────
const PRIORITY_PILL: Record<Priority, string> = {
  low:    'badge-green border text-[11px]',
  medium: 'badge-gray border text-[11px]',
  high:   'badge-amber border text-[11px]',
  urgent: 'badge-red border text-[11px] animate-pulse',
}

// ─────────────────────────────────────────────────────────────
// GROUP TASKS BY DEADLINE
// ─────────────────────────────────────────────────────────────
type GroupedTasks = {
  overdue:  MyTaskItem[]
  today:    MyTaskItem[]
  upcoming: MyTaskItem[]
  noDate:   MyTaskItem[]
}

function groupTasks(tasks: MyTaskItem[], search: string, filterKey: FilterKey): GroupedTasks {
  const now        = new Date()
  const todayStart = startOfDay(now)
  const tomorrowStart = addDays(todayStart, 1)

  const normalized = search.trim().toLowerCase()
  const filtered = tasks.filter((t) => {
    if (normalized && !t.description?.toLowerCase().includes(normalized)) return false
    if (filterKey === 'urgent')  return t.priority === 'urgent' || t.priority === 'high'
    if (filterKey === 'overdue') {
      if (!t.due_at) return false
      return isBefore(parseISO(t.due_at), todayStart)
    }
    if (filterKey === 'today') {
      if (!t.due_at) return false
      const d = parseISO(t.due_at)
      return !isBefore(d, todayStart) && isBefore(d, tomorrowStart)
    }
    return true
  })

  const overdue:  MyTaskItem[] = []
  const today:    MyTaskItem[] = []
  const upcoming: MyTaskItem[] = []
  const noDate:   MyTaskItem[] = []

  for (const task of filtered) {
    if (!task.due_at) {
      noDate.push(task)
    } else {
      const d = parseISO(task.due_at)
      if (isBefore(d, todayStart)) {
        overdue.push(task)
      } else if (isBefore(d, tomorrowStart)) {
        today.push(task)
      } else {
        upcoming.push(task)
      }
    }
  }

  return { overdue, today, upcoming, noDate }
}

// ─────────────────────────────────────────────────────────────
// FILTER KEY
// ─────────────────────────────────────────────────────────────
type FilterKey = 'all' | 'urgent' | 'overdue' | 'today'

// ─────────────────────────────────────────────────────────────
// TASK CARD
// ─────────────────────────────────────────────────────────────
interface TaskCardProps {
  task: MyTaskItem
  onComplete: (taskId: string) => void
  completing: boolean
}

function relativeDeadline(dueAt: string | null): { label: string; cls: string } | null {
  if (!dueAt) return null
  const d = parseISO(dueAt)
  const todayStart = startOfDay(new Date())
  const overdue = isBefore(d, todayStart)

  if (isToday(d)) {
    return { label: 'Hoje', cls: 'text-amber-600 dark:text-amber-400 font-semibold' }
  }
  if (overdue) {
    return {
      label: `Atrasado ${formatDistanceToNow(d, { locale: ptBR, addSuffix: false })}`,
      cls:   'text-red-600 dark:text-red-400 font-semibold',
    }
  }
  return {
    label: format(d, "d MMM", { locale: ptBR }),
    cls:   'text-muted-foreground',
  }
}

function TaskCard({ task, onComplete, completing }: TaskCardProps) {
  const deadline  = relativeDeadline(task.due_at ?? null)
  const showPriority = task.priority !== 'medium'

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-3 py-3 rounded-xl border border-border bg-card',
        'transition-colors hover:border-border',
        task.priority === 'urgent' && 'border-l-2 border-l-red-400',
        completing && 'animate-task-complete',
      )}
    >
      {/* Checkbox — 44px tap zone wrapper */}
      <button
        aria-label="Marcar como concluído"
        onClick={() => onComplete(task.id)}
        className="shrink-0 flex items-center justify-center w-11 h-11 -m-2 rounded-xl"
      >
        <span className={cn(
          'w-5 h-5 rounded-full border-2 border-border',
          'hover:border-primary hover:bg-primary/10 transition-colors',
          'flex items-center justify-center',
        )} />
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        {/* Title */}
        <p className="text-sm text-foreground leading-snug line-clamp-2">
          {task.description ?? '(sem descrição)'}
        </p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {/* Priority */}
          {showPriority && (
            <span className={cn('px-1.5 py-0.5 rounded', PRIORITY_PILL[task.priority])}>
              {PRIORITY_LABELS[task.priority]}
            </span>
          )}

          {/* Deadline */}
          {deadline && (
            <span className={cn('flex items-center gap-0.5 text-[11px]', deadline.cls)}>
              <CalendarDays className="w-3 h-3" />
              {deadline.label}
            </span>
          )}

          {/* Checklist link */}
          {task.checklist && (
            <Link
              href={`/checklists/${task.checklist.id}`}
              className="text-[11px] text-muted-foreground hover:text-primary truncate max-w-[180px] transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {task.checklist.title}
            </Link>
          )}
        </div>

        {/* Event */}
        {task.checklist?.event && (
          <div className="flex items-center gap-1">
            <CalendarCheck className="w-3 h-3 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-muted-foreground truncate">
              {task.checklist.event.title}
            </span>
          </div>
        )}
      </div>

      {/* Estimated time */}
      {task.estimated_minutes && task.estimated_minutes > 0 && (
        <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
          {task.estimated_minutes < 60
            ? `${task.estimated_minutes}min`
            : `${Math.floor(task.estimated_minutes / 60)}h${task.estimated_minutes % 60 ? ` ${task.estimated_minutes % 60}m` : ''}`
          }
        </span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TASK GROUP
// ─────────────────────────────────────────────────────────────
interface TaskGroupProps {
  title: string
  count: number
  dotClass: string
  tasks: MyTaskItem[]
  completingIds: Set<string>
  onComplete: (id: string) => void
  defaultOpen?: boolean
}

function TaskGroup({ title, count, dotClass, tasks, completingIds, onComplete, defaultOpen = true }: TaskGroupProps) {
  const [open, setOpen] = useState(defaultOpen)

  if (count === 0) return null

  return (
    <div className="space-y-2">
      {/* Section header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-left w-full group"
      >
        <span className={cn('w-2 h-2 rounded-full shrink-0', dotClass)} />
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
          {count}
        </span>
        <span className="ml-auto text-muted-foreground text-xs opacity-0 group-hover:opacity-100 transition-opacity">
          {open ? 'ocultar' : 'mostrar'}
        </span>
      </button>

      {open && (
        <div className="space-y-2 pl-0">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onComplete={onComplete}
              completing={completingIds.has(task.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// KPI CARD (simple — no countUp for brevity)
// ─────────────────────────────────────────────────────────────
interface SimpleKpiProps {
  label: string
  value: number
  icon: React.ReactNode
  iconClass?: string
  variant?: 'default' | 'error' | 'success' | 'warning'
  delay?: number
}

function SimpleKpi({ label, value, icon, iconClass = 'icon-brand', variant = 'default', delay = 0 }: SimpleKpiProps) {
  return (
    <div
      className={cn(
        'bg-card border rounded-xl p-3 flex flex-col gap-1.5 animate-fade-up',
        variant === 'error' && value > 0
          ? 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20'
          : variant === 'warning' && value > 0
          ? 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20'
          : variant === 'success' && value > 0
          ? 'border-green-200 bg-green-50 dark:border-green-900/40 dark:bg-green-950/20'
          : 'border-border',
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}
    >
      <div className={cn('p-1.5 rounded-lg self-start', iconClass)}>{icon}</div>
      <p className={cn(
        'text-2xl font-bold tabular-nums',
        variant === 'error'   && value > 0 ? 'text-red-600 dark:text-red-400'     :
        variant === 'warning' && value > 0 ? 'text-amber-600 dark:text-amber-400' :
        variant === 'success' && value > 0 ? 'text-green-600 dark:text-green-400' :
        'text-foreground',
      )}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground leading-snug">{label}</p>
    </div>
  )
}

function SimpleKpiSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-3 space-y-1.5">
      <Skeleton className="w-8 h-8 rounded-lg" />
      <Skeleton className="h-7 w-10 rounded" />
      <Skeleton className="h-3 w-20 rounded" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// FILTER PILLS
// ─────────────────────────────────────────────────────────────
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',     label: 'Todos' },
  { key: 'urgent',  label: 'Urgentes' },
  { key: 'overdue', label: 'Atrasados' },
  { key: 'today',   label: 'Hoje' },
]

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default function MinhasTarefasPage() {
  const router = useRouter()
  const { profile } = useAuth()
  const qc = useQueryClient()

  const [search,     setSearch]     = useState('')
  const [filterKey,  setFilterKey]  = useState<FilterKey>('all')
  const [completing, setCompleting] = useState<Set<string>>(new Set())

  const userId = profile?.id ?? null

  const { data: tasks = [], isLoading, isError } = useMyTasks(userId)
  const { data: doneCount = 0 } = useMyCompletedTasksCount(userId)

  // ── Group tasks ──────────────────────────────────────────────
  const grouped = groupTasks(tasks, search, filterKey)
  const totalVisible = grouped.overdue.length + grouped.today.length + grouped.upcoming.length + grouped.noDate.length

  // ── KPIs ─────────────────────────────────────────────────────
  const todayStart = startOfDay(new Date())
  const tomorrowStart = addDays(todayStart, 1)

  const overdueCount = tasks.filter((t) => t.due_at && isBefore(parseISO(t.due_at), todayStart)).length
  const todayCount   = tasks.filter((t) => {
    if (!t.due_at) return false
    const d = parseISO(t.due_at)
    return !isBefore(d, todayStart) && isBefore(d, tomorrowStart)
  }).length

  // ── Complete task ────────────────────────────────────────────
  const handleComplete = useCallback(async (taskId: string) => {
    // Add to completing set (triggers animation)
    setCompleting((prev) => new Set(prev).add(taskId))

    // Wait for animation
    await new Promise<void>((r) => setTimeout(r, 380))

    try {
      const supabase = createClient()
      await supabase
        .from('checklist_items')
        .update({
          status:   'done',
          done_by:  userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId)

      qc.invalidateQueries({ queryKey: ['my-tasks'] })
      qc.invalidateQueries({ queryKey: ['my-completed-tasks-count'] })
      qc.invalidateQueries({ queryKey: ['checklist-items'] })
    } finally {
      setCompleting((prev) => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }
  }, [userId, qc])

  // ── Loading state ────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="h-6 w-48 rounded" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <SimpleKpiSkeleton key={i} />)}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // ── Empty state (no tasks at all) ────────────────────────────
  if (!isLoading && !isError && tasks.length === 0) {
    return (
      <div className="space-y-6">
        {/* Back header */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.push('/checklists')} className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Minhas Tarefas</h1>
            {profile && (
              <p className="text-xs text-muted-foreground">
                {profile.name.split(' ')[0]}
              </p>
            )}
          </div>
        </div>

        <EmptyState
          icon={CheckCircle2}
          title="Tudo em dia!"
          description="Você não tem nenhuma tarefa pendente atribuída a você."
          action={{
            label: 'Ver checklists',
            onClick: () => router.push('/checklists'),
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/checklists')} className="h-8 w-8 shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-foreground">Minhas Tarefas</h1>
          {profile && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <UserAvatar
                name={profile.name}
                avatarUrl={profile.avatar_url}
                size="sm"
              />
              <p className="text-xs text-muted-foreground">{profile.name.split(' ')[0]}</p>
            </div>
          )}
        </div>
        <span className="text-sm text-muted-foreground tabular-nums shrink-0">
          {tasks.length} pendente{tasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── KPIs ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SimpleKpi
          label="Pendentes"
          value={tasks.length}
          icon={<ListTodo className="w-4 h-4" />}
          iconClass="icon-brand"
          delay={0}
        />
        <SimpleKpi
          label="Atrasados"
          value={overdueCount}
          icon={<AlertTriangle className="w-4 h-4" />}
          iconClass={overdueCount > 0 ? 'icon-red' : 'icon-gray'}
          variant={overdueCount > 0 ? 'error' : 'default'}
          delay={50}
        />
        <SimpleKpi
          label="Vencem hoje"
          value={todayCount}
          icon={<Clock className="w-4 h-4" />}
          iconClass={todayCount > 0 ? 'icon-amber' : 'icon-gray'}
          variant={todayCount > 0 ? 'warning' : 'default'}
          delay={100}
        />
        <SimpleKpi
          label="Feitos (7 dias)"
          value={doneCount}
          icon={<CheckCircle2 className="w-4 h-4" />}
          iconClass={doneCount > 0 ? 'icon-green' : 'icon-gray'}
          variant={doneCount > 0 ? 'success' : 'default'}
          delay={150}
        />
      </div>

      {/* ── Error state ─────────────────────────────────────── */}
      {isError && (
        <div className="p-4 rounded-lg bg-status-error-bg border border-status-error-border text-sm text-status-error-text">
          Erro ao carregar tarefas. Tente recarregar a página.
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────── */}
      <div className="space-y-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar tarefas…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              'w-full h-9 pl-9 pr-9 rounded-lg border border-border bg-background text-sm',
              'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
            )}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterKey(f.key)}
              className={cn(
                'text-xs px-3 py-1.5 rounded-full border shrink-0 transition-colors',
                filterKey === f.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Task groups ─────────────────────────────────────── */}
      {totalVisible === 0 && !isLoading ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nenhuma tarefa encontrada"
          description={
            search
              ? 'Tente remover a busca para ver mais tarefas.'
              : 'Nenhuma tarefa corresponde ao filtro selecionado.'
          }
          action={
            search || filterKey !== 'all'
              ? {
                  label: 'Limpar filtros',
                  onClick: () => { setSearch(''); setFilterKey('all') },
                }
              : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          <TaskGroup
            title="Atrasados"
            count={grouped.overdue.length}
            dotClass="bg-red-500"
            tasks={grouped.overdue}
            completingIds={completing}
            onComplete={handleComplete}
            defaultOpen
          />
          <TaskGroup
            title="Hoje"
            count={grouped.today.length}
            dotClass="bg-amber-500"
            tasks={grouped.today}
            completingIds={completing}
            onComplete={handleComplete}
            defaultOpen
          />
          <TaskGroup
            title="Próximos"
            count={grouped.upcoming.length}
            dotClass="bg-green-500"
            tasks={grouped.upcoming}
            completingIds={completing}
            onComplete={handleComplete}
            defaultOpen
          />
          <TaskGroup
            title="Sem prazo"
            count={grouped.noDate.length}
            dotClass="bg-border"
            tasks={grouped.noDate}
            completingIds={completing}
            onComplete={handleComplete}
            defaultOpen={false}
          />
        </div>
      )}
    </div>
  )
}
