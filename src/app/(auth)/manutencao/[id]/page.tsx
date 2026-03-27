'use client'

import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, isPast, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ArrowLeft, Calendar, Edit, MapPin, RefreshCw,
  Trash2, User, Wrench, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { UserAvatar } from '@/components/shared/user-avatar'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  useMaintenanceOrder,
  useChangeMaintenanceStatus,
  useCompleteMaintenanceOrder,
  useDeleteMaintenanceOrder,
} from '@/hooks/use-maintenance'
import { MaintenanceTypeBadge } from '@/components/features/maintenance/maintenance-type-badge'
import { MaintenanceStatusBadge, MaintenancePriorityBadge } from '@/components/features/maintenance/maintenance-status-badge'
import { MaintenanceTimeline } from '@/components/features/maintenance/maintenance-timeline'
import { PhotoSection } from '@/components/features/maintenance/photo-section'
import { cn } from '@/lib/utils'
import type { MaintenanceStatus } from '@/types/database.types'

const FREQ_LABEL: Record<string, string> = {
  daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal',
}
const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// ─────────────────────────────────────────────────────────────
// PÁGINA
// ─────────────────────────────────────────────────────────────
export default function DetalheOrdemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()

  const { data: order, isLoading, isError } = useMaintenanceOrder(id)
  const changeStatus = useChangeMaintenanceStatus()
  const completeOrder = useCompleteMaintenanceOrder()
  const deleteOrder = useDeleteMaintenanceOrder()

  if (isLoading) return <OrderSkeleton />

  if (isError || !order) {
    return (
      <div className="space-y-4">
        <Link href="/manutencao" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <p className="text-sm text-destructive">Ordem não encontrada ou sem permissão de acesso.</p>
      </div>
    )
  }

  const isOverdue = !!(
    order.due_date &&
    order.status !== 'completed' &&
    order.status !== 'cancelled' &&
    isPast(parseISO(order.due_date))
  )

  const canComplete = order.status !== 'completed' && order.status !== 'cancelled'

  async function handleComplete() {
    await completeOrder.mutateAsync(order!.id)
    // Atualização da query já ocorre dentro do hook
  }

  async function handleDelete() {
    await deleteOrder.mutateAsync(order!.id)
    router.push('/manutencao')
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Back */}
      <Link href="/manutencao" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit">
        <ArrowLeft className="w-4 h-4" />
        Voltar para Manutenção
      </Link>

      {/* Header */}
      <div className={cn(
        'bg-card rounded-xl border p-5 space-y-4',
        isOverdue ? 'border-red-300' : 'border-border'
      )}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <MaintenanceTypeBadge type={order.type} />
              <MaintenancePriorityBadge priority={order.priority} />
              <MaintenanceStatusBadge status={order.status} />
              {isOverdue && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                  <AlertTriangle className="w-3 h-3" />
                  Atrasada
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-foreground leading-tight">{order.title}</h1>
            {order.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{order.description}</p>
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-wrap gap-2 pt-1">
          {canComplete && (
            <ConfirmDialog
              title="Concluir ordem?"
              description={
                order.type === 'recurring'
                  ? 'A ordem será marcada como concluída e uma nova instância será gerada automaticamente com a próxima data.'
                  : 'A ordem será marcada como concluída. Esta ação não pode ser desfeita.'
              }
              onConfirm={handleComplete}
              confirmLabel="Concluir"
              trigger={
                <Button size="sm" variant="default" disabled={completeOrder.isPending}>
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Concluir
                </Button>
              }
            />
          )}
          <Link href={`/manutencao/${order.id}/editar`}>
            <Button size="sm" variant="outline">
              <Edit className="w-4 h-4 mr-1.5" />
              Editar
            </Button>
          </Link>
          <ConfirmDialog
            title="Excluir ordem?"
            description="Esta ação não pode ser desfeita. A ordem e todas as fotos associadas serão removidas."
            onConfirm={handleDelete}
            confirmLabel="Excluir"
            destructive
            trigger={
              <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="w-4 h-4 mr-1.5" />
                Excluir
              </Button>
            }
          />
        </div>

        {/* Mudar Status inline */}
        {canComplete && (
          <div className="flex items-center gap-3 pt-1 border-t border-border/50">
            <span className="text-xs text-muted-foreground">Alterar status:</span>
            <Select
              value={order.status}
              onValueChange={(v) => changeStatus.mutate({ id: order.id, status: v as MaintenanceStatus })}
            >
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Aberta</SelectItem>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="waiting_parts">Aguardando Peças</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Grid de informações */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Localização */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Localização</h2>
          <Separator />
          {order.sector ? (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
              <span>{order.sector.name}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">Setor não informado</p>
          )}
          {order.equipment && (
            <div className="flex items-center gap-2 text-sm">
              <Wrench className="w-4 h-4 text-muted-foreground shrink-0" />
              <span>{order.equipment}</span>
            </div>
          )}
        </div>

        {/* Responsável */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Responsável</h2>
          <Separator />
          {order.assigned_user ? (
            <div className="flex items-center gap-3">
              <UserAvatar name={order.assigned_user.name} avatarUrl={order.assigned_user.avatar_url} size="sm" />
              <div>
                <p className="text-sm font-medium">{order.assigned_user.name}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
              <User className="w-4 h-4" />
              Sem responsável atribuído
            </div>
          )}
          {order.due_date && (
            <>
              <Separator />
              <div className={cn(
                'flex items-center gap-2 text-sm',
                isOverdue && 'text-red-600 font-medium'
              )}>
                <Calendar className="w-4 h-4 shrink-0" />
                <span>
                  Prazo: {format(parseISO(order.due_date), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  {isOverdue && ' — ATRASADA'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Recorrência */}
      {order.type === 'recurring' && order.recurrence_rule && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <RefreshCw className="w-4 h-4 text-green-600" />
            Regra de Recorrência
          </h2>
          <Separator />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Frequência</p>
              <p className="font-medium">{FREQ_LABEL[order.recurrence_rule.frequency] ?? order.recurrence_rule.frequency}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Intervalo</p>
              <p className="font-medium">A cada {order.recurrence_rule.interval}</p>
            </div>
            {order.recurrence_rule.day_of_week !== undefined && (
              <div>
                <p className="text-xs text-muted-foreground">Dia da Semana</p>
                <p className="font-medium">{DAY_NAMES[order.recurrence_rule.day_of_week]}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Próxima data</p>
              <p className="font-medium">
                {order.recurrence_rule.next_due_date
                  ? format(parseISO(order.recurrence_rule.next_due_date), "d MMM yyyy", { locale: ptBR })
                  : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Fotos */}
      <PhotoSection
        orderId={order.id}
        photos={order.maintenance_photos}
        canEdit={canComplete}
      />

      {/* Timeline */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Histórico</h2>
        <Separator />
        <MaintenanceTimeline orderId={order.id} />
      </div>

      {/* Criado por */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground pb-2">
        {order.creator && (
          <>
            <UserAvatar name={order.creator.name} avatarUrl={order.creator.avatar_url} size="sm" />
            <span>Criado por {order.creator.name}</span>
          </>
        )}
        <span>·</span>
        <span>{format(new Date(order.created_at), "d 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────
function OrderSkeleton() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Skeleton className="h-4 w-32" />
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-16 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
    </div>
  )
}
