'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Users, AlertTriangle, Clock, CheckCircle2, ListTodo,
  Search, X, CalendarDays, CalendarCheck, ArrowLeft, ChevronDown,
  ShieldOff,
} from 'lucide-react'
import {
  startOfDay, addDays, isBefore, parseISO, formatDistanceToNow, format, isToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { UserAvatar } from '@/components/shared/user-avatar'
import { useAuth } from '@/hooks/use-auth'
import { useUnitStore } from '@/stores/unit-store'
import { useUnitUsers } from '@/hooks/use-units'
import { useDebounce } from '@/hooks/use-debounce'
import { useTeamTasks, useTeamCompletedCount, type TeamTaskItem } from '@/hooks/use-team-tasks'
import { cn } from '@/lib/utils'
import { PRIORITY_LABELS } from '@/types/database.types'
import type { Priority } from '@/types/database.types'
import { hasRole, TEAM_TASKS_ROLES } from '@/config/roles'

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
// HELPERS
// ─────────────────────────────────────────────────────────────
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
      cls: 'text-red-600 dark:text-red-400 font-semibold',
    }
  }
  return {
    label: format(d, 'd MMM', { locale: ptBR }),
    cls: 'text-muted-foreground',
  }
}

function isOverdue(dueAt: string | null): boolean {
  if (!dueAt) return false
  return isBefore(parseISO(dueAt), startOfDay(new Date()))
}

// ─────────────────────────────────────────────────────────────
// KPI CARD (reutilizável)
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
// TEAM TASK CARD (sem checkbox — apenas visualização)
// ─────────────────────────────────────────────────────────────
interface TeamTaskCardProps {
  task: TeamTaskItem
}

function TeamTaskCard({ task }: TeamTaskCardProps) {
  const deadline = relativeDeadline(task.due_at ?? null)
  const showPriority = task.priority !== 'medium'

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-3 py-3',
        task.priority === 'urgent' && 'border-l-2 border-l-red-400',
      )}
    >
      {/* Status indicator dot */}
      <div className="shrink-0 flex items-center justify-center w-6 h-6 mt-0.5">
        <span className={cn(
          'w-2.5 h-2.5 rounded-full',
          isOverdue(task.due_at) ? 'bg-red-500' : 'bg-border',
        )} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm text-foreground leading-snug line-clamp-2">
          {task.description ?? '(sem descrição)'}
        </p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {showPriority && (
            <span className={cn('px-1.5 py-0.5 rounded', PRIORITY_PILL[task.priority])}>
              {PRIORITY_LABELS[task.priority]}
            </span>
          )}

          {deadline && (
            <span className={cn('flex items-center gap-0.5 text-[11px]', deadline.cls)}>
              <CalendarDays className="w-3 h-3" />
              {deadline.label}
            </span>
          )}

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

        {task.checklist?.event && (
          <div className="flex items-center gap-1">
            <CalendarCheck className="w-3 h-3 text-muted-foreground shrink-0" />
            <Link
              href={`/eventos/${task.checklist.event.id}`}
              className="text-[11px] text-muted-foreground hover:text-primary truncate transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {task.checklist.event.title}
            </Link>
          </div>
        )}
      </div>

      {/* Estimated time */}
      {task.estimated_minutes != null && task.estimated_minutes > 0 && (
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
// PERSON GROUP (accordion)
// ─────────────────────────────────────────────────────────────
interface PersonGroupProps {
  memberId: string
  memberName: string
  memberAvatar: string | null
  tasks: TeamTaskItem[]
  defaultOpen?: boolean
}

function PersonGroup({ memberId: _memberId, memberName, memberAvatar, tasks, defaultOpen = true }: PersonGroupProps) {
  const [open, setOpen] = useState(defaultOpen)
  const count = tasks.length
  const hasOverdue = tasks.some((t) => isOverdue(t.due_at))

  if (count === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
      >
        <UserAvatar name={memberName} avatarUrl={memberAvatar} size="sm" />
        <span className="font-medium text-sm flex-1 text-left">{memberName}</span>
        <span className="text-xs text-muted-foreground">
          {count} pendente{count !== 1 ? 's' : ''}
        </span>
        {hasOverdue && (
          <span className="badge-red border text-[11px] px-1.5 py-0.5 rounded shrink-0">
            Atrasado
          </span>
        )}
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="divide-y divide-border border-t border-border">
          {tasks.map((task) => (
            <TeamTaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// GROUP SKELETON
// ─────────────────────────────────────────────────────────────
function PersonGroupSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <Skeleton className="w-7 h-7 rounded-full shrink-0" />
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-3 w-16 rounded ml-auto" />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default function TarefasEquipePage() {
  const router = useRouter()
  const { profile } = useAuth()
  const activeUnitId = useUnitStore((s) => s.activeUnitId)

  const [searchRaw, setSearchRaw] = useState('')
  const [filterMemberId, setFilterMemberId] = useState('')
  const search = useDebounce(searchRaw, 200)

  // ── Verificação de permissão ────────────────────────────────
  const canAccess = hasRole(profile?.role, TEAM_TASKS_ROLES)

  // ── Data fetching ───────────────────────────────────────────
  const { data: unitUsers = [], isLoading: usersLoading } = useUnitUsers(activeUnitId ?? undefined)
  const { data: tasks = [], isLoading: tasksLoading, isError } = useTeamTasks(filterMemberId || undefined)
  const { data: doneCount = 0 } = useTeamCompletedCount(activeUnitId)

  const isLoading = usersLoading || tasksLoading

  // ── KPIs ─────────────────────────────────────────────────────
  const todayStart = startOfDay(new Date())
  const tomorrowStart = addDays(todayStart, 1)

  const overdueCount = tasks.filter((t) => t.due_at && isBefore(parseISO(t.due_at), todayStart)).length
  const todayCount = tasks.filter((t) => {
    if (!t.due_at) return false
    const d = parseISO(t.due_at)
    return !isBefore(d, todayStart) && isBefore(d, tomorrowStart)
  }).length

  // ── Agrupar por pessoa ────────────────────────────────────────
  // Map userId -> UserUnit para lookup eficiente
  const userMap = useMemo(() => {
    const map = new Map<string, { name: string; avatar_url: string | null }>()
    for (const uu of unitUsers) {
      if (uu.user?.id) {
        map.set(uu.user.id, { name: uu.user.name, avatar_url: uu.user.avatar_url })
      }
    }
    return map
  }, [unitUsers])

  // Filtrar tarefas por busca de texto
  const filteredTasks = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    if (!normalized) return tasks
    return tasks.filter((t) => t.description?.toLowerCase().includes(normalized))
  }, [tasks, search])

  // Agrupar por assigned_to
  const grouped = useMemo(() => {
    const map = new Map<string, TeamTaskItem[]>()
    for (const task of filteredTasks) {
      if (!task.assigned_to) continue
      const existing = map.get(task.assigned_to) ?? []
      existing.push(task)
      map.set(task.assigned_to, existing)
    }
    return map
  }, [filteredTasks])

  // Ordenar: grupos com tarefas atrasadas primeiro
  const sortedMemberIds = useMemo(() => {
    return Array.from(grouped.keys()).sort((a, b) => {
      const aHasOverdue = (grouped.get(a) ?? []).some((t) => isOverdue(t.due_at))
      const bHasOverdue = (grouped.get(b) ?? []).some((t) => isOverdue(t.due_at))
      if (aHasOverdue && !bHasOverdue) return -1
      if (!aHasOverdue && bHasOverdue) return 1
      return 0
    })
  }, [grouped])

  const totalVisible = filteredTasks.length

  // ── Access denied ─────────────────────────────────────────────
  if (!canAccess) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.push('/checklists')} className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Tarefas da Equipe</h1>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="icon-red p-4 rounded-2xl">
            <ShieldOff className="w-8 h-8" />
          </div>
          <div>
            <p className="font-semibold text-foreground text-lg">Acesso restrito</p>
            <p className="text-sm text-muted-foreground mt-1">
              Esta página está disponível apenas para gerentes, diretores e administradores.
            </p>
          </div>
          <Button variant="outline" onClick={() => router.push('/checklists')}>
            Voltar para Checklists
          </Button>
        </div>
      </div>
    )
  }

  // ── Loading ───────────────────────────────────────────────────
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
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <PersonGroupSkeleton key={i} />)}
        </div>
      </div>
    )
  }

  // ── Sem membros na unidade ────────────────────────────────────
  if (unitUsers.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => router.push('/checklists')} className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Tarefas da Equipe</h1>
        </div>
        <EmptyState
          icon={Users}
          title="Nenhum membro na unidade"
          description="Adicione colaboradores à unidade para visualizar as tarefas da equipe."
          action={{ label: 'Gerenciar unidade', onClick: () => router.push('/admin/unidades') }}
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
          <h1 className="text-lg font-semibold text-foreground">Tarefas da Equipe</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {unitUsers.length} membro{unitUsers.length !== 1 ? 's' : ''} na unidade
          </p>
        </div>
        <span className="text-sm text-muted-foreground tabular-nums shrink-0">
          {tasks.length} pendente{tasks.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SimpleKpi
          label="Atribuídas"
          value={tasks.length}
          icon={<ListTodo className="w-4 h-4" />}
          iconClass="icon-brand"
          delay={0}
        />
        <SimpleKpi
          label="Atrasadas"
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
          label="Feitas (7 dias)"
          value={doneCount}
          icon={<CheckCircle2 className="w-4 h-4" />}
          iconClass={doneCount > 0 ? 'icon-green' : 'icon-gray'}
          variant={doneCount > 0 ? 'success' : 'default'}
          delay={150}
        />
      </div>

      {/* ── Error ────────────────────────────────────────────── */}
      {isError && (
        <div className="p-4 rounded-lg bg-status-error-bg border border-status-error-border text-sm text-status-error-text">
          Erro ao carregar tarefas. Tente recarregar a página.
        </div>
      )}

      {/* ── Filtros ──────────────────────────────────────────── */}
      <div className="space-y-2">
        {/* Busca por texto */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar tarefas…"
            value={searchRaw}
            onChange={(e) => setSearchRaw(e.target.value)}
            className={cn(
              'w-full h-9 pl-9 pr-9 rounded-lg border border-border bg-background text-sm',
              'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring',
            )}
          />
          {searchRaw && (
            <button
              onClick={() => setSearchRaw('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filtro por membro */}
        <div className="flex items-center gap-2">
          <label htmlFor="member-filter" className="text-xs text-muted-foreground whitespace-nowrap">
            Membro:
          </label>
          <select
            id="member-filter"
            value={filterMemberId}
            onChange={(e) => setFilterMemberId(e.target.value)}
            className={cn(
              'flex-1 h-9 px-3 rounded-lg border border-border bg-background text-sm',
              'focus:outline-none focus:ring-2 focus:ring-ring',
            )}
          >
            <option value="">Todos os membros</option>
            {unitUsers.map((uu) => (
              <option key={uu.user?.id} value={uu.user?.id ?? ''}>
                {uu.user?.name ?? ''}
              </option>
            ))}
          </select>

          {(filterMemberId || searchRaw) && (
            <button
              onClick={() => { setFilterMemberId(''); setSearchRaw('') }}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0"
            >
              <X className="w-3 h-3" />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────── */}
      {totalVisible === 0 && !isLoading ? (
        <EmptyState
          icon={CheckCircle2}
          title={searchRaw || filterMemberId ? 'Nenhuma tarefa encontrada' : 'Tudo em dia!'}
          description={
            searchRaw || filterMemberId
              ? 'Tente remover os filtros para ver mais tarefas.'
              : 'Nenhum membro da equipe tem tarefas pendentes atribuídas.'
          }
          action={
            searchRaw || filterMemberId
              ? { label: 'Limpar filtros', onClick: () => { setSearchRaw(''); setFilterMemberId('') } }
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {sortedMemberIds.map((memberId, index) => {
            const memberTasks = grouped.get(memberId) ?? []
            const memberInfo = userMap.get(memberId)
            if (!memberInfo) return null

            return (
              <PersonGroup
                key={memberId}
                memberId={memberId}
                memberName={memberInfo.name}
                memberAvatar={memberInfo.avatar_url}
                tasks={memberTasks}
                defaultOpen={index === 0}
              />
            )
          })}

          {tasks.length >= 200 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              Exibindo os primeiros 200 itens pendentes. Use o filtro por membro para ver mais.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
