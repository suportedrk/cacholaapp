'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  RefreshCw, Plus, ArrowLeft, MoreVertical,
  Zap, Trash2, CalendarDays, Clock, Play,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/shared/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  useChecklistRecurrences,
  useUpdateRecurrence,
  useDeleteRecurrence,
  useGenerateRecurrenceNow,
} from '@/hooks/use-checklist-recurrences'
import {
  CreateRecurrenceModal,
  type RecurrenceWithJoins,
} from './components/create-recurrence-modal'
import { SelectUnitModal } from '@/components/shared/select-unit-modal'
import { useUnitStore } from '@/stores/unit-store'

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const FREQ_LABELS = {
  daily:    'Diária',
  weekly:   'Semanal',
  biweekly: 'Quinzenal',
  monthly:  'Mensal',
} as const

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function humanizeFrequency(rec: RecurrenceWithJoins): string {
  const base = FREQ_LABELS[rec.frequency]
  if (rec.frequency === 'monthly' && rec.day_of_month) {
    return `${base} · dia ${rec.day_of_month}`
  }
  if ((rec.frequency === 'weekly' || rec.frequency === 'biweekly') && rec.day_of_week?.length) {
    const days = rec.day_of_week.map((d) => DAY_LABELS[d]).join(', ')
    return `${base} · ${days}`
  }
  return base
}

function fmtNextGen(iso: string | null): string {
  if (!iso) return '—'
  try {
    return format(parseISO(iso), "d 'de' MMM 'às' HH:mm", { locale: ptBR })
  } catch {
    return '—'
  }
}

// ─────────────────────────────────────────────────────────────
// RECURRENCE CARD
// ─────────────────────────────────────────────────────────────
function RecurrenceCard({
  rec,
  onEdit,
}: {
  rec: RecurrenceWithJoins
  onEdit: (r: RecurrenceWithJoins) => void
}) {
  const { mutate: update, isPending: isUpdating }  = useUpdateRecurrence()
  const { mutate: del }                             = useDeleteRecurrence()
  const { mutate: generate, isPending: isGenerating } = useGenerateRecurrenceNow()
  const [deleteOpen, setDeleteOpen]                 = useState(false)

  return (
    <div className={cn(
      'bg-card border rounded-xl p-4 flex flex-col gap-3 transition-opacity',
      !rec.is_active && 'opacity-60',
    )}>
      {/* ── Header row: icon + info + toggle + menu ── */}
      <div className="flex items-start gap-3">
        <div className={cn(
          'flex items-center justify-center w-10 h-10 rounded-lg shrink-0',
          rec.is_active
            ? 'bg-purple-100 dark:bg-purple-900/30'
            : 'bg-muted',
        )}>
          <RefreshCw className={cn(
            'w-5 h-5',
            rec.is_active
              ? 'text-purple-600 dark:text-purple-400'
              : 'text-muted-foreground',
          )} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">
            {rec.title_prefix
              ? `${rec.title_prefix} — …`
              : (rec.template?.title ?? 'Sem título')}
          </p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            Template: {rec.template?.title ?? '—'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Switch
            checked={rec.is_active}
            onCheckedChange={(v) => update({ id: rec.id, isActive: v })}
            disabled={isUpdating}
            aria-label={rec.is_active ? 'Pausar recorrência' : 'Ativar recorrência'}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" className="w-8 h-8">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              {rec.is_active && (
                <>
                  <DropdownMenuItem
                    onClick={() => generate(rec.id)}
                    disabled={isGenerating}
                    className="gap-2"
                  >
                    <Play className="w-4 h-4" />
                    {isGenerating ? 'Gerando…' : 'Gerar agora'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={() => onEdit(rec)} className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Editar regra
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => { window.location.href = '/checklists?type=recurring' }}
                className="gap-2"
              >
                <CalendarDays className="w-4 h-4" />
                Ver checklists gerados
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
                Excluir regra
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── Frequency + time + assignee ── */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" />
          {humanizeFrequency(rec)}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {rec.time_of_day.slice(0, 5)}
        </span>
        {rec.assigned_user && (
          <span className="flex items-center gap-1.5">
            <UserAvatar
              name={rec.assigned_user.name}
              avatarUrl={rec.assigned_user.avatar_url}
              size="sm"
              className="w-4 h-4 text-[9px]"
            />
            {rec.assigned_user.name.split(' ')[0]}
          </span>
        )}
      </div>

      {/* ── Next generation pill ── */}
      <div className={cn(
        'flex items-center gap-1.5 text-xs rounded-lg px-3 py-2',
        rec.is_active
          ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300'
          : 'bg-muted text-muted-foreground',
      )}>
        <Zap className="w-3.5 h-3.5 shrink-0" />
        <span>
          Próxima geração: <strong>{fmtNextGen(rec.next_generation_at)}</strong>
        </span>
      </div>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir regra de recorrência?"
        description="Esta ação não pode ser desfeita. Os checklists já gerados serão mantidos."
        confirmLabel="Excluir"
        destructive
        onConfirm={() => {
          del(rec.id)
          setDeleteOpen(false)
        }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────
function RecurrenceSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="w-10 h-10 rounded-lg shrink-0 skeleton-shimmer" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-3/4 skeleton-shimmer" />
          <Skeleton className="h-3 w-1/2 skeleton-shimmer" />
        </div>
        <Skeleton className="h-6 w-10 rounded-full skeleton-shimmer" />
      </div>
      <Skeleton className="h-3 w-40 skeleton-shimmer" />
      <Skeleton className="h-8 w-full rounded-lg skeleton-shimmer" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default function RecorrenciasPage() {
  const [createOpen, setCreateOpen]       = useState(false)
  const [editTarget, setEditTarget]       = useState<RecurrenceWithJoins | null>(null)
  const [selectUnitOpen, setSelectUnitOpen] = useState(false)
  const { activeUnitId } = useUnitStore()

  function guardedCreate() {
    if (activeUnitId === null) {
      setSelectUnitOpen(true)
    } else {
      setCreateOpen(true)
    }
  }

  const { data: recurrences = [], isLoading, isError } = useChecklistRecurrences(false)

  const active   = recurrences.filter((r) => (r as RecurrenceWithJoins).is_active).length
  const inactive = recurrences.length - active

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recorrências"
        description="Regras de geração automática de checklists"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/checklists"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Checklists
            </Link>
            <Button size="sm" onClick={guardedCreate}>
              <Plus className="w-4 h-4 mr-1.5" />
              Nova regra
            </Button>
          </div>
        }
      />

      {/* Stats */}
      {!isLoading && recurrences.length > 0 && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
          <span>
            <strong className="text-foreground">{recurrences.length}</strong>{' '}
            regra{recurrences.length !== 1 ? 's' : ''} no total
          </span>
          <span>·</span>
          <span className="text-purple-600 dark:text-purple-400">
            <strong>{active}</strong> ativa{active !== 1 ? 's' : ''}
          </span>
          {inactive > 0 && (
            <>
              <span>·</span>
              <span>{inactive} pausada{inactive !== 1 ? 's' : ''}</span>
            </>
          )}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="p-4 rounded-lg bg-status-error-bg border border-status-error-border text-sm text-status-error-text">
          Erro ao carregar regras de recorrência. Tente recarregar a página.
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <RecurrenceSkeleton key={i} />)}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && recurrences.length === 0 && (
        <EmptyState
          icon={RefreshCw}
          title="Nenhuma regra de recorrência"
          description="Crie regras para gerar checklists automaticamente a partir de templates."
          action={{ label: 'Nova regra', onClick: guardedCreate }}
        />
      )}

      {/* Grid */}
      {!isLoading && recurrences.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {(recurrences as RecurrenceWithJoins[]).map((rec, i) => (
            <div
              key={rec.id}
              className="animate-fade-up"
              style={{
                animationDelay: `${Math.min(i * 40, 300)}ms`,
                animationFillMode: 'backwards',
              }}
            >
              <RecurrenceCard
                rec={rec}
                onEdit={(r) => setEditTarget(r)}
              />
            </div>
          ))}
        </div>
      )}

      {/* SelectUnit guard */}
      <SelectUnitModal
        open={selectUnitOpen}
        onClose={() => setSelectUnitOpen(false)}
        onConfirm={() => { setSelectUnitOpen(false); setCreateOpen(true) }}
      />

      {/* Create modal */}
      <CreateRecurrenceModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />

      {/* Edit modal */}
      {editTarget && (
        <CreateRecurrenceModal
          open
          onClose={() => setEditTarget(null)}
          editTarget={editTarget}
        />
      )}
    </div>
  )
}
