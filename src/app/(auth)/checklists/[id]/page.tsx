'use client'

import { useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowLeft, Calendar, User, Clock, CheckCircle2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ChecklistProgress } from '@/components/features/checklists/checklist-progress'
import { ChecklistItemRow } from '@/components/features/checklists/checklist-item-row'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { useChecklist, useUpdateChecklistItem, useUpdateChecklistStatus } from '@/hooks/use-checklists'
import { useAuth } from '@/hooks/use-auth'
import { calcProgress } from '@/components/features/checklists/checklist-progress'
import { cn } from '@/lib/utils'
import type { ChecklistItemStatus } from '@/types/database.types'
import { useState } from 'react'

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

  const { data: checklist, isLoading, isError } = useChecklist(id)
  const updateItem   = useUpdateChecklistItem()
  const updateStatus = useUpdateChecklistStatus()

  const [confirmFinish, setConfirmFinish] = useState(false)

  const isCompleted = checklist?.status === 'completed'
  const isCancelled = checklist?.status === 'cancelled'
  const isReadOnly  = isCompleted || isCancelled

  const handleItemStatus = useCallback((itemId: string, status: ChecklistItemStatus) => {
    updateItem.mutate({
      itemId,
      checklistId: id,
      status,
      userId: profile?.id,
    })
  }, [id, profile?.id, updateItem])

  const handleItemNotes = useCallback((itemId: string, notes: string) => {
    updateItem.mutate({ itemId, checklistId: id, notes, userId: profile?.id })
  }, [id, profile?.id, updateItem])

  const handleItemPhoto = useCallback((itemId: string, file: File) => {
    updateItem.mutate({ itemId, checklistId: id, photoFile: file, userId: profile?.id })
  }, [id, profile?.id, updateItem])

  async function handleFinish() {
    await updateStatus.mutateAsync({ id, status: 'completed' })
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
          Checklist não encontrado ou erro ao carregar.
        </div>
      </div>
    )
  }

  const { done, total, pct } = calcProgress(checklist.checklist_items)

  return (
    // Padding bottom extra para o footer sticky não sobrepor os últimos itens
    <div className="space-y-4 pb-24">
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
            disabled={isReadOnly || updateItem.isPending}
            onStatusChange={(status) => handleItemStatus(item.id, status)}
            onNotesChange={(notes)  => handleItemNotes(item.id, notes)}
            onPhotoChange={(file)   => handleItemPhoto(item.id, file)}
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
              disabled={done === 0 || updateItem.isPending}
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
        loading={updateStatus.isPending}
        onConfirm={handleFinish}
      />
    </div>
  )
}
