'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  MoreVertical, Copy, FileText, Trash2, CalendarDays,
  ChevronDown, ChevronUp, CheckCircle2, ClipboardCopy, RefreshCw,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/shared/user-avatar'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { useDeleteChecklist } from '@/hooks/use-checklists'
import { cn } from '@/lib/utils'
import {
  PRIORITY_LABELS, CHECKLIST_TYPE_LABELS,
} from '@/types/database.types'
import type { ChecklistWithItems, Priority } from '@/types/database.types'
import { DuplicateChecklistModal } from './duplicate-checklist-modal'
const ExportPdfModal = dynamic(() => import('./export-pdf-modal').then((m) => ({ default: m.ExportPdfModal })), { ssr: false })

// ─────────────────────────────────────────────────────────────
// PROGRESS RING
// ─────────────────────────────────────────────────────────────
interface ProgressRingProps {
  pct: number
  size?: number
  strokeWidth?: number
  label?: boolean
}

function ProgressRing({ pct, size = 48, strokeWidth = 4, label = false }: ProgressRingProps) {
  const r       = (size - strokeWidth) / 2
  const circ    = 2 * Math.PI * r
  const offset  = circ - (pct / 100) * circ
  const center  = size / 2

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={center} cy={center} r={r}
          strokeWidth={strokeWidth}
          className="stroke-border fill-none"
        />
        {/* Progress */}
        <circle
          cx={center} cy={center} r={r}
          strokeWidth={strokeWidth}
          fill="none"
          className="stroke-primary transition-all duration-500"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      {label && (
        <span className="absolute text-[11px] font-bold tabular-nums text-foreground rotate-0">
          {pct}%
        </span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// RECURRENCE HELPERS
// ─────────────────────────────────────────────────────────────
const RECURRENCE_FREQ_LABELS: Record<string, string> = {
  daily:    'Diário',
  weekly:   'Semanal',
  biweekly: 'Quinzenal',
  monthly:  'Mensal',
}

const RECURRENCE_DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function humanizeRecurrence(rec: { frequency: string; day_of_week?: number[] | null; day_of_month?: number | null }): string {
  const base = RECURRENCE_FREQ_LABELS[rec.frequency] ?? rec.frequency
  if (rec.frequency === 'weekly' && rec.day_of_week?.length) {
    const days = rec.day_of_week.slice(0, 3).map((d) => RECURRENCE_DAY_LABELS[d]).join(', ')
    return `${base} · ${days}`
  }
  if (rec.frequency === 'biweekly' && rec.day_of_week?.length) {
    const days = rec.day_of_week.slice(0, 2).map((d) => RECURRENCE_DAY_LABELS[d]).join(', ')
    return `${base} · ${days}`
  }
  if (rec.frequency === 'monthly' && rec.day_of_month) {
    return `${base} · dia ${rec.day_of_month}`
  }
  return base
}

// ─────────────────────────────────────────────────────────────
// PRIORITY PILL
// ─────────────────────────────────────────────────────────────
const PRIORITY_PILL: Record<Priority, string> = {
  low:    'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400',
  high:   'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400',
  urgent: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 animate-pulse',
}

// ─────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────
interface ChecklistDetailHeaderProps {
  checklist: ChecklistWithItems
  done:  number
  total: number
  pct:   number
  currentUserId?: string
  isUpdating: boolean
  justSaved:  boolean
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export function ChecklistDetailHeader({
  checklist,
  done,
  total,
  pct,
  currentUserId: _currentUserId,
  isUpdating,
  justSaved,
}: ChecklistDetailHeaderProps) {
  const router = useRouter()
  const [descOpen,      setDescOpen]      = useState(false)
  const [deleteOpen,    setDeleteOpen]    = useState(false)
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [exportPdfOpen, setExportPdfOpen] = useState(false)

  const { mutate: deleteChecklist, isPending: isDeleting } = useDeleteChecklist()

  const isCompleted = checklist.status === 'completed'

  // Estimated minutes remaining
  const items = checklist.checklist_items
  const pendingItems = items.filter((i) => i.status === 'pending')
  const totalEstimated = items.reduce((s, i) => s + (i.estimated_minutes ?? 0), 0)
  const pendingEstimated = pendingItems.reduce((s, i) => s + (i.estimated_minutes ?? 0), 0)
  const hasEstimate = totalEstimated > 0

  function fmtMinutes(mins: number) {
    if (mins < 60) return `${mins}min`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m ? `${h}h ${m}min` : `${h}h`
  }

  function handleDelete() {
    deleteChecklist(checklist.id, {
      onSuccess: () => router.push('/checklists'),
    })
  }

  // ─────── completed banner ────────────────────────────────────
  if (isCompleted) {
    return (
      <>
        <div className="rounded-2xl bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-900/40 p-5 flex items-center gap-4">
          <div className="relative shrink-0">
            <ProgressRing pct={pct} size={56} strokeWidth={5} label />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
              <h2 className="text-sm font-semibold text-green-800 dark:text-green-300">
                Concluído!
              </h2>
            </div>
            <p className="text-xs text-green-700 dark:text-green-400">
              {done} de {total} ite{total !== 1 ? 'ns' : 'm'} · {pct}% concluído{pct !== 100 ? 's' : ''}
            </p>
            {checklist.completed_by_user && (
              <p className="text-xs text-green-600/70 dark:text-green-500 mt-0.5">
                por {checklist.completed_by_user.name.split(' ')[0]}
              </p>
            )}
          </div>
          {/* Duplicate after completion */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDuplicateOpen(true)}
            className="shrink-0 gap-1.5"
          >
            <Copy className="w-3.5 h-3.5" />
            Duplicar
          </Button>
        </div>

        {/* Duplicate modal (completed banner) */}
        <DuplicateChecklistModal
          open={duplicateOpen}
          onClose={() => setDuplicateOpen(false)}
          checklist={checklist}
          onDuplicated={(newId) => router.push(`/checklists/${newId}`)}
        />
      </>
    )
  }

  // ─────── normal header ───────────────────────────────────────
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="p-4">
        {/* Row 1: ring + title + menu */}
        <div className="flex items-start gap-3">
          {/* Progress ring */}
          <ProgressRing pct={pct} size={56} strokeWidth={5} label />

          {/* Title + badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 flex-wrap mb-1">
              {/* Type badge */}
              <span className="badge-gray border text-[11px] px-1.5 py-0.5 rounded">
                {CHECKLIST_TYPE_LABELS[checklist.type ?? 'standalone']}
              </span>
              {/* Priority badge */}
              {checklist.priority && checklist.priority !== 'medium' && (
                <span className={cn(
                  'text-[11px] px-1.5 py-0.5 rounded border',
                  PRIORITY_PILL[checklist.priority],
                )}>
                  {PRIORITY_LABELS[checklist.priority]}
                </span>
              )}
              {/* Save indicator */}
              {isUpdating && (
                <span className="text-[11px] text-muted-foreground animate-pulse">Salvando…</span>
              )}
              {justSaved && !isUpdating && (
                <span className="text-[11px] text-green-600 dark:text-green-400">Salvo ✓</span>
              )}
            </div>

            <h1 className="text-base font-semibold text-foreground leading-tight">
              {checklist.title}
            </h1>

            {/* Event link */}
            {checklist.event && (
              <Link
                href={`/eventos/${checklist.event.id}`}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mt-0.5 transition-colors"
              >
                <CalendarDays className="w-3 h-3" />
                {checklist.event.title}
              </Link>
            )}
          </div>

          {/* ⋮ Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon" className="w-8 h-8 shrink-0 -mr-1 -mt-1">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={() => setDuplicateOpen(true)}
                className="gap-2"
              >
                <Copy className="w-4 h-4" />
                Duplicar checklist
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setExportPdfOpen(true)}
                className="gap-2"
              >
                <FileText className="w-4 h-4" />
                Exportar PDF
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setDeleteOpen(true)}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
                Excluir checklist
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Row 2: assigned + estimated time */}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          {checklist.assigned_user && (
            <div className="flex items-center gap-1.5">
              <UserAvatar
                name={checklist.assigned_user.name}
                avatarUrl={checklist.assigned_user.avatar_url}
                size="sm"
              />
              <span className="text-xs text-muted-foreground">
                {checklist.assigned_user.name.split(' ')[0]}
              </span>
            </div>
          )}

          {hasEstimate && (
            <span className="text-xs text-muted-foreground">
              {pendingEstimated > 0
                ? `~${fmtMinutes(pendingEstimated)} restantes`
                : `Estimativa: ${fmtMinutes(totalEstimated)}`}
            </span>
          )}

          <span className="ml-auto text-xs font-medium tabular-nums text-foreground">
            {done}/{total} itens
          </span>
        </div>

        {/* Recurrence banner */}
        {checklist.recurrence && (
          <div className="flex items-center gap-2 mt-2 rounded-lg bg-status-info-bg border border-status-info-border px-3 py-2 text-xs text-status-info-text">
            <RefreshCw className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1 leading-snug">
              Gerado automaticamente · {humanizeRecurrence(checklist.recurrence)}
            </span>
            <Link
              href="/checklists/recorrencias"
              className="shrink-0 font-medium hover:underline whitespace-nowrap"
            >
              Ver regra →
            </Link>
          </div>
        )}

        {/* Duplicado de... indicator */}
        {checklist.duplicated_from && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <ClipboardCopy className="w-3 h-3 shrink-0" />
            <span>Duplicado de</span>
            <Link
              href={`/checklists/${checklist.duplicated_from}`}
              className="hover:text-foreground underline truncate"
            >
              checklist original
            </Link>
          </div>
        )}

        {/* Description (collapsible) */}
        {checklist.description && (
          <div className="mt-3 border-t border-border/60 pt-3">
            <button
              onClick={() => setDescOpen((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
            >
              {descOpen ? (
                <ChevronUp className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 shrink-0" />
              )}
              {descOpen ? 'Ocultar descrição' : 'Ver descrição'}
            </button>
            {descOpen && (
              <p className="mt-2 text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                {checklist.description}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Progress bar (bottom of card) */}
      <div className="h-1.5 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500 rounded-r-full"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir checklist?"
        description="Esta ação não pode ser desfeita. Todos os itens e registros serão removidos."
        confirmLabel="Excluir"
        destructive
        loading={isDeleting}
        onConfirm={handleDelete}
      />

      {/* Duplicate modal */}
      <DuplicateChecklistModal
        open={duplicateOpen}
        onClose={() => setDuplicateOpen(false)}
        checklist={checklist}
        onDuplicated={(newId) => router.push(`/checklists/${newId}`)}
      />

      {/* Export PDF modal */}
      <ExportPdfModal
        open={exportPdfOpen}
        onClose={() => setExportPdfOpen(false)}
        checklist={checklist}
      />
    </div>
  )
}
