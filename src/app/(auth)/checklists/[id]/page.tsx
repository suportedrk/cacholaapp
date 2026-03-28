'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ArrowLeft, Calendar, User, Clock,
  CheckCircle2, WifiOff, RotateCw, ClipboardList,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ChecklistProgress } from '@/components/features/checklists/checklist-progress'
import { ChecklistItemRow } from '@/components/features/checklists/checklist-item-row'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { useOfflineChecklist } from '@/hooks/use-offline-checklist'
import { useAuth } from '@/hooks/use-auth'
import { calcProgress } from '@/components/features/checklists/checklist-progress'
import { cn } from '@/lib/utils'
import type { ChecklistItemStatus } from '@/types/database.types'

const STATUS_LABEL = {
  pending:     'Pendente',
  in_progress: 'Em Andamento',
  completed:   'Concluído',
  cancelled:   'Cancelado',
}

// ─── Indicador de salvamento inline ──────────────────────────
function SaveIndicator({ isUpdating, justSaved }: { isUpdating: boolean; justSaved: boolean }) {
  if (isUpdating) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground animate-pulse shrink-0">
        <RotateCw className="w-3 h-3" />
        Salvando…
      </span>
    )
  }
  if (justSaved) {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 shrink-0">
        <CheckCircle2 className="w-3 h-3" />
        Salvo
      </span>
    )
  }
  return null
}

// ─── Estado vazio ─────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted">
        <ClipboardList className="w-8 h-8 opacity-50" />
      </div>
      <p className="text-sm font-medium">Nenhum item neste checklist.</p>
      <p className="text-xs opacity-60">Adicione itens via template ou edição.</p>
    </div>
  )
}

// ─── Estado completo (celebração) ────────────────────────────
function CompletedBanner({ pct, done, total }: { pct: number; done: number; total: number }) {
  return (
    <div className="rounded-2xl bg-green-50 border border-green-200 dark:bg-green-950/30 dark:border-green-900/40 p-6 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/40 mb-3 animate-celebrate">
        <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
      </div>
      <h2 className="text-base font-semibold text-green-800 dark:text-green-300 mb-1">
        Checklist Concluído!
      </h2>
      <p className="text-sm text-green-700 dark:text-green-400">
        {done} de {total} ite{total !== 1 ? 'ns' : 'm'} · {pct}% concluído{pct !== 100 ? 's' : ''}
      </p>
    </div>
  )
}

// ─── Loading skeleton ──────────────────────────────────────────
function ChecklistLoadingSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <Skeleton className="h-5 w-40 skeleton-shimmer" />
      <Skeleton className="h-2 w-full rounded-full skeleton-shimmer" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full rounded-xl skeleton-shimmer" />
      ))}
    </div>
  )
}

// ─── Página principal ──────────────────────────────────────────
export default function ChecklistFillPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
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
    handleFinish,
  } = useOfflineChecklist(id)

  const [confirmFinish, setConfirmFinish] = useState(false)
  const [justSaved, setJustSaved]         = useState(false)
  const prevUpdating = useRef(false)

  // Detecta quando isUpdating passa de true → false para mostrar "Salvo ✓"
  useEffect(() => {
    if (prevUpdating.current && !isUpdating) {
      setJustSaved(true)
      const t = setTimeout(() => setJustSaved(false), 2000)
      return () => clearTimeout(t)
    }
    prevUpdating.current = isUpdating
  }, [isUpdating])

  const isCompleted = checklist?.status === 'completed'
  const isCancelled = checklist?.status === 'cancelled'
  const isReadOnly  = isCompleted || isCancelled

  async function onFinish() {
    await handleFinish()
    setConfirmFinish(false)
    router.push('/checklists')
  }

  // ── Loading ──
  if (isLoading) return <ChecklistLoadingSkeleton />

  // ── Erro ──
  if (isError || !checklist) {
    return (
      <div className="space-y-4 p-4">
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

  const { done, total, pct } = calcProgress(checklist.checklist_items)

  return (
    /* Container full-height para sticky funcionar dentro do <main> */
    <div className="flex flex-col -mt-4 lg:-mt-6 min-h-full pb-28">

      {/* ── Sticky header com progresso ── */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border -mx-4 lg:-mx-6 px-4 lg:px-6 pt-4 pb-3">
        {/* Linha 1: título + indicador de save */}
        <div className="flex items-start gap-3 mb-2.5">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-foreground leading-tight truncate">
              {checklist.title}
            </h1>
            {checklist.event && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {checklist.event.title}
              </p>
            )}
          </div>

          <SaveIndicator isUpdating={isUpdating} justSaved={justSaved} />
        </div>

        {/* Linha 2: barra de progresso + contagem */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <ChecklistProgress items={checklist.checklist_items} showLabel={false} />
          </div>
          <span className="text-xs font-medium text-foreground shrink-0 tabular-nums">
            {done}/{total}
          </span>
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full shrink-0',
            isCompleted ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400' :
            isCancelled ? 'bg-muted text-muted-foreground' :
            checklist.status === 'in_progress' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400' :
            'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
          )}>
            {STATUS_LABEL[checklist.status]}
          </span>
        </div>
      </div>

      {/* ── Conteúdo scrollável ── */}
      <div className="flex flex-col gap-3 px-0 py-4">

        {/* Banner offline */}
        {isOffline && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
            <WifiOff className="size-4 shrink-0" />
            <span className="flex-1 leading-snug">
              Sem conexão — alterações serão sincronizadas ao reconectar.
            </span>
            {pendingCount > 0 && (
              <span className="shrink-0 rounded-full bg-amber-200 dark:bg-amber-800 px-2 py-0.5 text-xs font-medium">
                {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* Banner sincronizando */}
        {isSyncing && (
          <div className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/50 px-3 py-2.5 text-sm text-blue-800 dark:text-blue-300">
            <RotateCw className="size-4 shrink-0 animate-spin" />
            Sincronizando alterações com o servidor…
          </div>
        )}

        {/* Meta do checklist (data, responsável, prazo) */}
        {(checklist.event?.date || checklist.assigned_user || checklist.due_date) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground px-1">
            {checklist.event?.date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(parseISO(checklist.event.date), "d MMM yyyy", { locale: ptBR })}
              </span>
            )}
            {checklist.assigned_user && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {checklist.assigned_user.name}
              </span>
            )}
            {checklist.due_date && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Prazo: {format(parseISO(checklist.due_date), "d MMM HH:mm", { locale: ptBR })}
              </span>
            )}
          </div>
        )}

        {/* ── Lista de itens ── */}
        {checklist.checklist_items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            {checklist.checklist_items.map((item) => (
              <ChecklistItemRow
                key={item.id}
                item={item}
                disabled={isReadOnly || isUpdating}
                onStatusChange={(status: ChecklistItemStatus) =>
                  handleItemStatus(item.id, status, profile?.id)}
                onNotesChange={(notes: string) =>
                  handleItemNotes(item.id, notes, profile?.id)}
                onPhotoChange={isOffline
                  ? undefined
                  : (file: File) => handleItemPhoto(item.id, file, profile?.id)}
              />
            ))}
          </div>
        )}

        {/* ── Celebração / estado concluído ── */}
        {isCompleted && (
          <CompletedBanner pct={pct} done={done} total={total} />
        )}

        {/* ── Estado cancelado ── */}
        {isCancelled && (
          <div className="rounded-xl bg-muted/60 border border-border p-4 text-center text-sm text-muted-foreground">
            Este checklist foi cancelado.
          </div>
        )}
      </div>

      {/* ── Footer sticky — botão de concluir ── */}
      {!isReadOnly && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border p-4 safe-area-inset-bottom">
          <div className="max-w-2xl mx-auto">
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={() => setConfirmFinish(true)}
              disabled={done === 0 || isUpdating || isOffline}
              title={isOffline ? 'Reconecte-se para finalizar' : undefined}
            >
              <CheckCircle2 className="w-5 h-5" />
              Concluir Checklist
              {done > 0 && (
                <span className="ml-1 opacity-80 text-sm font-normal">
                  ({done}/{total})
                </span>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Confirmação de finalização ── */}
      <ConfirmDialog
        open={confirmFinish}
        onOpenChange={setConfirmFinish}
        title="Finalizar checklist?"
        description={`${done} de ${total} itens concluídos (${pct}%). Os itens restantes ficarão como pendentes. Esta ação não pode ser desfeita.`}
        confirmLabel="Finalizar"
        loading={isFinishing}
        onConfirm={onFinish}
      />
    </div>
  )
}
