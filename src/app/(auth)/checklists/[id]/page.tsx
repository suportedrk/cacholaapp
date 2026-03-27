'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowLeft, Calendar, User, Clock, CheckCircle2, WifiOff, RotateCw } from 'lucide-react'
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

const CHECKLIST_STATUS_LABEL = {
  pending:     'Pendente',
  in_progress: 'Em Andamento',
  completed:   'Concluído',
  cancelled:   'Cancelado',
}

export default function ChecklistFillPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
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

  const isCompleted = checklist?.status === 'completed'
  const isCancelled = checklist?.status === 'cancelled'
  const isReadOnly  = isCompleted || isCancelled

  async function onFinish() {
    await handleFinish()
    setConfirmFinish(false)
    router.push('/checklists')
  }

  // ─── Loading ───
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-5 h-5" />
          <Skeleton className="h-7 w-48" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    )
  }

  // ─── Erro ───
  if (isError || !checklist) {
    return (
      <div className="space-y-4">
        <Link href="/checklists" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
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
    <div className="space-y-4 pb-24">

      {/* ── Banner offline ── */}
      {isOffline && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800">
          <WifiOff className="size-4 shrink-0" />
          <span className="flex-1">
            Sem conexão — alterações serão sincronizadas automaticamente ao reconectar.
          </span>
          {pendingCount > 0 && (
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium">
              {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* ── Banner sincronizando ── */}
      {isSyncing && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5 text-sm text-blue-800">
          <RotateCw className="size-4 shrink-0 animate-spin" />
          Sincronizando alterações com o servidor…
        </div>
      )}

      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2">
        <Link
          href={checklist.event ? `/eventos/${checklist.event.id}` : '/checklists'}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-foreground truncate">{checklist.title}</h1>
          {checklist.event && (
            <p className="text-xs text-muted-foreground truncate">{checklist.event.title}</p>
          )}
        </div>
      </div>

      {/* ── Status + meta ── */}
      <div className="bg-card border border-border rounded-xl p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            isCompleted ? 'bg-green-50 text-green-700' :
            isCancelled ? 'bg-gray-100 text-gray-500' :
            checklist.status === 'in_progress' ? 'bg-blue-50 text-blue-700' :
            'bg-amber-50 text-amber-700'
          )}>
            {CHECKLIST_STATUS_LABEL[checklist.status]}
          </span>
          <span className="text-xs text-muted-foreground">{done}/{total} · {pct}%</span>
        </div>

        <ChecklistProgress items={checklist.checklist_items} showLabel={false} />

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
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
      </div>

      {/* ── Itens ── */}
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
              ? undefined  // upload de foto indisponível offline
              : (file: File) => handleItemPhoto(item.id, file, profile?.id)}
          />
        ))}
        {checklist.checklist_items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum item neste checklist.
          </p>
        )}
      </div>

      {/* ── Footer sticky — só para checklists em andamento ── */}
      {!isReadOnly && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border p-4 safe-area-inset-bottom">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <ChecklistProgress
              items={checklist.checklist_items}
              showLabel={false}
              size="sm"
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={() => setConfirmFinish(true)}
              disabled={done === 0 || isUpdating || isOffline}
              title={isOffline ? 'Reconecte-se para finalizar' : undefined}
              className="shrink-0 gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Finalizar
            </Button>
          </div>
        </div>
      )}

      {isReadOnly && (
        <div className={cn(
          'rounded-xl p-4 text-center text-sm font-medium',
          isCompleted ? 'bg-green-50 text-green-700' : 'bg-muted text-muted-foreground'
        )}>
          {isCompleted ? `✓ Checklist concluído com ${pct}% dos itens` : 'Checklist cancelado'}
        </div>
      )}

      <ConfirmDialog
        open={confirmFinish}
        onOpenChange={setConfirmFinish}
        title="Finalizar checklist?"
        description={`${done} de ${total} itens concluídos (${pct}%). Os itens restantes ficarão como pendente. Esta ação não pode ser desfeita.`}
        confirmLabel="Finalizar"
        loading={isFinishing}
        onConfirm={onFinish}
      />
    </div>
  )
}
