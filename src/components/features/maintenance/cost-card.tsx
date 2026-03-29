'use client'

import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  FileText, Image, Paperclip, CheckCircle2, XCircle, Loader2, X, Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { RejectCostModal } from './reject-cost-modal'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  useApproveCost, useDeleteCost,
  COST_TYPE_LABELS, formatBRL,
  type CostWithRelations,
} from '@/hooks/use-maintenance-costs'

// ─────────────────────────────────────────────────────────────
// RECEIPT VIEWER BUTTON
// ─────────────────────────────────────────────────────────────
function ReceiptButton({ receiptUrl }: { receiptUrl: string }) {
  const [loading, setLoading] = useState(false)

  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(receiptUrl)

  async function handleView() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase.storage
        .from('maintenance-receipts')
        .createSignedUrl(receiptUrl, 3600)
      if (!data?.signedUrl) return
      window.open(data.signedUrl, '_blank')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleView}
      disabled={loading}
      className="gap-1.5 text-xs h-7"
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : isImage ? (
        <Image className="w-3 h-3" />
      ) : (
        <FileText className="w-3 h-3" />
      )}
      Comprovante
    </Button>
  )
}

// ─────────────────────────────────────────────────────────────
// STATUS CONFIG
// ─────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:  { label: 'Pendente',  badgeClass: 'badge-amber border', borderClass: 'border-l-amber-400 dark:border-l-amber-500' },
  approved: { label: 'Aprovado',  badgeClass: 'badge-green border', borderClass: 'border-l-green-500 dark:border-l-green-600' },
  rejected: { label: 'Reprovado', badgeClass: 'badge-red border',   borderClass: 'border-l-red-500 dark:border-l-red-600'   },
}

// ─────────────────────────────────────────────────────────────
// COST CARD
// ─────────────────────────────────────────────────────────────
interface CostCardProps {
  cost:          CostWithRelations
  currentUserId: string | null
  canApprove:    boolean
}

export function CostCard({ cost, currentUserId, canApprove }: CostCardProps) {
  const [rejectOpen, setRejectOpen] = useState(false)
  const approveCost = useApproveCost()
  const deleteCost  = useDeleteCost()

  const cfg          = STATUS_CONFIG[cost.status]
  const isOwnCost    = cost.submitted_by === currentUserId
  const canSelfApprove = canApprove && !isOwnCost  // manager can approve but not own cost
  const canCancel    = isOwnCost && cost.status === 'pending'

  return (
    <>
      <div className={cn(
        'bg-card rounded-xl border border-border border-l-4 p-4 space-y-3 card-interactive',
        cfg.borderClass,
      )}>
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cfg.badgeClass)}>
              {cfg.label}
            </span>
            <span className="text-xs text-muted-foreground">
              {COST_TYPE_LABELS[cost.cost_type]}
            </span>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {format(parseISO(cost.submitted_at), 'dd/MM/yyyy', { locale: ptBR })}
          </span>
        </div>

        {/* Description */}
        <p className="text-sm font-medium text-foreground leading-snug">{cost.description}</p>

        {/* Amount */}
        <p className="text-xl font-bold text-foreground">{formatBRL(Number(cost.amount))}</p>

        {/* Meta */}
        <div className="space-y-1">
          {cost.order && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="w-3 h-3 shrink-0" />
              <span className="truncate">Ordem: {cost.order.title}</span>
            </div>
          )}
          {cost.submitter && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="w-3 h-3 shrink-0" />
              <span>Enviado por: {cost.submitter.name}</span>
            </div>
          )}
        </div>

        {/* Approved / Rejected by */}
        {(cost.status === 'approved' || cost.status === 'rejected') && cost.reviewer && cost.reviewed_at && (
          <p className="text-xs text-muted-foreground">
            {cost.status === 'approved' ? 'Aprovado' : 'Reprovado'} por{' '}
            <span className="font-medium">{cost.reviewer.name}</span>{' '}
            em {format(parseISO(cost.reviewed_at), "d 'de' MMM", { locale: ptBR })}
          </p>
        )}

        {/* Rejection reason */}
        {cost.status === 'rejected' && cost.review_notes && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive leading-relaxed">
            <span className="font-semibold">Motivo: </span>{cost.review_notes}
          </div>
        )}

        {/* Footer: receipt + actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/50">
          {/* Receipt */}
          <div>
            {cost.receipt_url ? (
              <ReceiptButton receiptUrl={cost.receipt_url} />
            ) : (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Paperclip className="w-3 h-3" />
                Sem comprovante
              </span>
            )}
          </div>

          {/* Actions */}
          {cost.status === 'pending' && (
            <div className="flex items-center gap-1.5">
              {canSelfApprove && (
                <>
                  <ConfirmDialog
                    title="Aprovar custo?"
                    description={`Aprovar "${cost.description}" — ${formatBRL(Number(cost.amount))}?`}
                    confirmLabel="Aprovar"
                    onConfirm={() => approveCost.mutateAsync(cost.id)}
                    loading={approveCost.isPending}
                    trigger={
                      <Button size="sm" className="h-7 text-xs gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Aprovar
                      </Button>
                    }
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs gap-1"
                    onClick={() => setRejectOpen(true)}
                  >
                    <XCircle className="w-3 h-3" />
                    Reprovar
                  </Button>
                </>
              )}
              {canApprove && isOwnCost && (
                <span className="text-xs text-muted-foreground italic">Aguarda revisão</span>
              )}
              {canCancel && !canApprove && (
                <ConfirmDialog
                  title="Cancelar custo?"
                  description="O registro de custo será removido. Esta ação não pode ser desfeita."
                  confirmLabel="Cancelar custo"
                  destructive
                  onConfirm={() => deleteCost.mutateAsync({ costId: cost.id, receiptUrl: cost.receipt_url })}
                  loading={deleteCost.isPending}
                  trigger={
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive">
                      <X className="w-3 h-3" />
                      Cancelar
                    </Button>
                  }
                />
              )}
            </div>
          )}
        </div>
      </div>

      <RejectCostModal
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        costId={cost.id}
        amount={Number(cost.amount)}
        description={cost.description}
      />
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────
export function CostCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border border-l-4 border-l-border p-4 space-y-3">
      <div className="flex justify-between">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-6 w-24" />
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-3 w-36" />
      </div>
    </div>
  )
}
