'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, WifiOff, RotateCw, ClipboardList,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { useOfflineChecklist } from '@/hooks/use-offline-checklist'
import { useCompleteChecklist } from '@/hooks/use-checklists'
import { useAuth } from '@/hooks/use-auth'
import { useIsReadOnly } from '@/hooks/use-read-only'
import { calcProgress } from '@/components/features/checklists/checklist-progress'
import { cn } from '@/lib/utils'
import { ChecklistDetailHeader } from './components/checklist-detail-header'
import { ChecklistItemRow, type RichChecklistItem } from './components/checklist-item-row'
import type { ChecklistItemStatus } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// ITEM FILTER BAR
// ─────────────────────────────────────────────────────────────
type ItemFilter = 'all' | 'pending' | 'done' | 'na' | 'overdue' | 'my'

interface FilterBarProps {
  active:      ItemFilter
  onChange:    (f: ItemFilter) => void
  counts:      Record<ItemFilter, number>
  currentUserId?: string
}

function ItemFilterBar({ active, onChange, counts, currentUserId }: FilterBarProps) {
  const filters: { key: ItemFilter; label: string }[] = [
    { key: 'all',     label: 'Todos'    },
    { key: 'pending', label: 'Pendentes' },
    { key: 'done',    label: 'Feitos'   },
    { key: 'na',      label: 'N/A'      },
    { key: 'overdue', label: 'Atrasados' },
    ...(currentUserId ? [{ key: 'my' as ItemFilter, label: 'Meus' }] : []),
  ]

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 -mx-4 px-4 lg:-mx-6 lg:px-6">
      {filters.map((f) => (
        <button
          key={f.key}
          onClick={() => onChange(f.key)}
          className={cn(
            'flex items-center gap-1 px-3 h-7 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors',
            active === f.key
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80',
          )}
        >
          {f.label}
          {counts[f.key] > 0 && active !== f.key && (
            <span className="bg-background/30 rounded-full px-1.5 text-[10px] tabular-nums">
              {counts[f.key]}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────
function EmptyState({ filtered }: { filtered?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted">
        <ClipboardList className="w-8 h-8 opacity-50" />
      </div>
      {filtered ? (
        <>
          <p className="text-sm font-medium">Nenhum item neste filtro.</p>
          <p className="text-xs opacity-60">Tente outro filtro.</p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium">Nenhum item neste checklist.</p>
          <p className="text-xs opacity-60">Adicione itens via template ou edição.</p>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// LOADING SKELETON
// ─────────────────────────────────────────────────────────────
function ChecklistLoadingSkeleton() {
  return (
    <div className="space-y-3 py-4">
      <Skeleton className="h-28 w-full rounded-2xl skeleton-shimmer" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-20 rounded-full skeleton-shimmer" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl skeleton-shimmer" />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// FOOTER PROGRESS RING (32px)
// ─────────────────────────────────────────────────────────────
function FooterRing({ pct }: { pct: number }) {
  const size = 32, sw = 3
  const r      = (size - sw) / 2
  const circ   = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  const center = size / 2
  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={center} cy={center} r={r} strokeWidth={sw}
          className="stroke-primary-foreground/30 fill-none" />
        <circle cx={center} cy={center} r={r} strokeWidth={sw}
          fill="none" className="stroke-primary-foreground transition-all duration-500"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute text-[9px] font-bold text-primary-foreground tabular-nums rotate-0">
        {pct}%
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
import { isPast, startOfDay, parseISO, isToday } from 'date-fns'

function isItemOverdue(item: RichChecklistItem): boolean {
  if (!item.due_at || item.status !== 'pending') return false
  const d = startOfDay(parseISO(item.due_at))
  return isPast(d) && !isToday(d)
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default function ChecklistFillPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const { profile } = useAuth()

  const {
    checklist,
    isLoading,
    isError,
    isOffline,
    pendingCount,
    isSyncing,
    isUpdating,
    isFinishing,
    handleItemStatus,
    handleItemNotes,
    handleItemPhoto,
    handleFinish: _handleFinish,
  } = useOfflineChecklist(id)

  const { mutate: completeChecklist, isPending: isCompleting } = useCompleteChecklist()

  const [confirmFinish, setConfirmFinish] = useState(false)
  const [justSaved,     setJustSaved]     = useState(false)
  const [itemFilter,    setItemFilter]    = useState<ItemFilter>('all')
  const prevUpdating = useRef(false)

  // Detect isUpdating false → show "Salvo ✓"
  useEffect(() => {
    if (prevUpdating.current && !isUpdating) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setJustSaved(true)
      const t = setTimeout(() => setJustSaved(false), 2000)
      return () => clearTimeout(t)
    }
    prevUpdating.current = isUpdating
  }, [isUpdating])

  const isCompleted = checklist?.status === 'completed'
  const isCancelled = checklist?.status === 'cancelled'
  const isImpersonating = useIsReadOnly()
  const isReadOnly  = isCompleted || isCancelled || isImpersonating

  // ── Loading ──
  if (isLoading) return <ChecklistLoadingSkeleton />

  // ── Error ──
  if (isError || !checklist) {
    return (
      <div className="space-y-4 py-4">
        <Link
          href="/checklists"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          {isOffline
            ? 'Sem conexão e checklist não está em cache. Abra novamente quando online.'
            : 'Checklist não encontrado ou erro ao carregar.'}
        </div>
      </div>
    )
  }

  const allItems = checklist.checklist_items as RichChecklistItem[]
  const { done, total, pct } = calcProgress(allItems)

  // ── Counts per filter ──
  const counts: Record<ItemFilter, number> = {
    all:     allItems.length,
    pending: allItems.filter((i) => i.status === 'pending').length,
    done:    allItems.filter((i) => i.status === 'done').length,
    na:      allItems.filter((i) => i.status === 'na').length,
    overdue: allItems.filter(isItemOverdue).length,
    my:      allItems.filter((i) => i.assigned_to === profile?.id).length,
  }

  // ── Filtered items ──
  const visibleItems = allItems.filter((item) => {
    switch (itemFilter) {
      case 'pending': return item.status === 'pending'
      case 'done':    return item.status === 'done'
      case 'na':      return item.status === 'na'
      case 'overdue': return isItemOverdue(item)
      case 'my':      return item.assigned_to === profile?.id
      default:        return true
    }
  })

  // ── Required items not yet done ──
  const requiredPending = allItems.filter(
    (i) => i.is_required && i.status === 'pending',
  )

  async function onFinish() {
    if (!profile?.id) return
    completeChecklist(
      { checklistId: id, userId: profile.id },
      {
        onSuccess: () => {
          setConfirmFinish(false)
          router.push('/checklists')
        },
        onError: () => setConfirmFinish(false),
      },
    )
  }

  return (
    /* Container full-height para footer sticky funcionar */
    <div className="flex flex-col -mt-4 lg:-mt-6 min-h-full pb-28">

      {/* ── Offline banners ── */}
      {isOffline && (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300 mx-0 mt-4 mb-0">
          <WifiOff className="size-4 shrink-0" />
          <span className="flex-1 leading-snug">
            Sem conexão — alterações serão sincronizadas ao reconectar.
          </span>
          {pendingCount > 0 && (
            <span className="shrink-0 rounded-full bg-amber-200 dark:bg-amber-800 px-2 py-0.5 text-xs font-medium">
              {pendingCount}
            </span>
          )}
        </div>
      )}
      {isSyncing && (
        <div className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/50 px-3 py-2.5 text-sm text-blue-800 dark:text-blue-300 mx-0 mt-2 mb-0">
          <RotateCw className="size-4 shrink-0 animate-spin" />
          Sincronizando alterações com o servidor…
        </div>
      )}

      {/* ── Rich header ── */}
      <div className="py-4">
        <ChecklistDetailHeader
          checklist={checklist}
          done={done}
          total={total}
          pct={pct}
          currentUserId={profile?.id}
          isUpdating={isUpdating}
          justSaved={justSaved}
        />
      </div>

      {/* ── Item filter bar ── */}
      {allItems.length > 0 && !isReadOnly && (
        <div className="mb-3">
          <ItemFilterBar
            active={itemFilter}
            onChange={setItemFilter}
            counts={counts}
            currentUserId={profile?.id}
          />
        </div>
      )}

      {/* ── Item list ── */}
      <div className="flex-1">
        {allItems.length === 0 ? (
          <EmptyState />
        ) : visibleItems.length === 0 ? (
          <EmptyState filtered />
        ) : (
          <div className="space-y-2">
            {visibleItems.map((item) => (
              <ChecklistItemRow
                key={item.id}
                item={item}
                checklistId={id}
                disabled={isReadOnly || isUpdating}
                currentUserId={profile?.id}
                onStatusChange={(status: ChecklistItemStatus) =>
                  handleItemStatus(item.id, status, profile?.id)
                }
                onNotesChange={(notes: string) =>
                  handleItemNotes(item.id, notes, profile?.id)
                }
                onPhotoChange={isOffline
                  ? undefined
                  : (file: File) => handleItemPhoto(item.id, file, profile?.id)
                }
              />
            ))}
          </div>
        )}

        {/* Cancelled state */}
        {isCancelled && (
          <div className="rounded-xl bg-muted/60 border border-border p-4 text-center text-sm text-muted-foreground mt-4">
            Este checklist foi cancelado.
          </div>
        )}
      </div>

      {/* ── Sticky footer ── */}
      {!isReadOnly && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border px-4 pb-4 pt-3"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            {/* Mini ring */}
            <FooterRing pct={pct} />

            {/* Concluir button */}
            <Button
              size="lg"
              className="flex-1 gap-2"
              onClick={() => setConfirmFinish(true)}
              disabled={done === 0 || isUpdating || isOffline || isCompleting}
              title={isOffline ? 'Reconecte-se para finalizar' : undefined}
            >
              Concluir Checklist
              <span className="opacity-80 text-sm font-normal tabular-nums">
                {done}/{total}
              </span>
            </Button>
          </div>
        </div>
      )}

      {/* ── Confirm finish ── */}
      {requiredPending.length > 0 ? (
        <ConfirmDialog
          open={confirmFinish}
          onOpenChange={setConfirmFinish}
          title="Itens obrigatórios pendentes"
          description={`Atenção: ${requiredPending.length} ite${requiredPending.length !== 1 ? 'ns' : 'm'} obrigatório${requiredPending.length !== 1 ? 's' : ''} ainda não concluído${requiredPending.length !== 1 ? 's' : ''}. Finalize-os antes de concluir.`}
          confirmLabel="Entendido"
          hideCancelButton
          loading={false}
          onConfirm={() => setConfirmFinish(false)}
        />
      ) : (
        <ConfirmDialog
          open={confirmFinish}
          onOpenChange={setConfirmFinish}
          title="Finalizar checklist?"
          description={`${done} de ${total} itens concluídos (${pct}%). Esta ação não pode ser desfeita.`}
          confirmLabel="Finalizar"
          loading={isCompleting || isFinishing}
          onConfirm={onFinish}
        />
      )}
    </div>
  )
}
