'use client'

import { use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format, isPast, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ArrowLeft, Calendar, Edit, MapPin, RefreshCw,
  Trash2, User, Wrench, CheckCircle2, AlertTriangle, DollarSign, Plus,
  Building2, CalendarDays, Clock, Shield, ExternalLink,
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
import { differenceInHours, differenceInDays } from 'date-fns'
import { MaintenanceTypeBadge } from '@/components/features/maintenance/maintenance-type-badge'
import { MaintenanceStatusBadge, MaintenancePriorityBadge } from '@/components/features/maintenance/maintenance-status-badge'
import { MaintenanceTimeline } from '@/components/features/maintenance/maintenance-timeline'
import { PhotoSection } from '@/components/features/maintenance/photo-section'
import { CostCard, CostCardSkeleton } from '@/components/features/maintenance/cost-card'
import { CostFormModal } from '@/components/features/maintenance/cost-form-modal'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { useOrderCosts, useCurrentUser, MANAGER_ROLES, formatBRL } from '@/hooks/use-maintenance-costs'
import type { MaintenanceStatus } from '@/types/database.types'

const FREQ_LABEL: Record<string, string> = {
  daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal',
}
const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function formatResolutionTime(createdAt: string, completedAt: string): string {
  const hours = differenceInHours(new Date(completedAt), new Date(createdAt))
  if (hours < 1) return '< 1h'
  if (hours < 24) return `${hours}h`
  const days = differenceInDays(new Date(completedAt), new Date(createdAt))
  return `${days} dia${days !== 1 ? 's' : ''}`
}

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

  const [costFormOpen, setCostFormOpen] = useState(false)

  const { data: order, isLoading, isError } = useMaintenanceOrder(id)
  const changeStatus   = useChangeMaintenanceStatus()
  const completeOrder  = useCompleteMaintenanceOrder()
  const deleteOrder    = useDeleteMaintenanceOrder()
  const { data: costs = [], isLoading: costsLoading } = useOrderCosts(id)
  const { data: currentUser } = useCurrentUser()

  const currentUserId = currentUser?.id ?? null
  const canApprove    = !!currentUser && (MANAGER_ROLES as readonly string[]).includes(currentUser.role)

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
                <SelectItem value="completed">Concluída</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Grid de informações */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Localização */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Localização & Contexto</h2>
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
              <Link
                href={`/equipamentos/${order.equipment.id}`}
                className="text-primary hover:underline font-medium inline-flex items-center gap-1"
              >
                {order.equipment.name}
                <ExternalLink className="w-3 h-3" />
              </Link>
              {order.equipment.location && (
                <span className="text-muted-foreground">— {order.equipment.location}</span>
              )}
            </div>
          )}
          {(order as any).supplier && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <Link
                href={`/manutencao/fornecedores/${(order as any).supplier.id}`}
                className="text-primary hover:underline font-medium inline-flex items-center gap-1"
              >
                {(order as any).supplier.company_name}
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}
          {(order as any).event && (
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
              <Link
                href={`/eventos/${(order as any).event.id}`}
                className="text-primary hover:underline font-medium inline-flex items-center gap-1"
              >
                {(order as any).event.title}
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>

        {/* Responsável e Datas */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">Responsável & Datas</h2>
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
          {order.status === 'completed' && (order as any).completed_at && (
            <>
              <Separator />
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  Concluída em {format(new Date((order as any).completed_at), "d 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4 shrink-0" />
                <span>
                  Tempo de resolução: <span className="font-medium text-foreground">
                    {formatResolutionTime(order.created_at, (order as any).completed_at)}
                  </span>
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

      {/* Plano Preventivo */}
      {order.type === 'preventive' && (order as any).preventive_plan && (
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Shield className="w-4 h-4 text-blue-600" />
            Plano de Manutenção Preventiva
          </h2>
          <Separator />
          {(() => {
            const plan = (order as any).preventive_plan as {
              frequency?: string
              interval?: number
              checklist_items?: string[]
              last_performed_at?: string
              next_due_date?: string
              advance_notice_days?: number
            }
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  {plan.frequency && (
                    <div>
                      <p className="text-xs text-muted-foreground">Frequência</p>
                      <p className="font-medium">{FREQ_LABEL[plan.frequency] ?? plan.frequency}</p>
                    </div>
                  )}
                  {plan.interval && (
                    <div>
                      <p className="text-xs text-muted-foreground">Intervalo</p>
                      <p className="font-medium">A cada {plan.interval}</p>
                    </div>
                  )}
                  {plan.next_due_date && (
                    <div>
                      <p className="text-xs text-muted-foreground">Próxima data</p>
                      <p className="font-medium">
                        {format(parseISO(plan.next_due_date), "d MMM yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  )}
                  {plan.advance_notice_days !== undefined && (
                    <div>
                      <p className="text-xs text-muted-foreground">Aviso antecipado</p>
                      <p className="font-medium">{plan.advance_notice_days} dias</p>
                    </div>
                  )}
                  {plan.last_performed_at && (
                    <div>
                      <p className="text-xs text-muted-foreground">Última realização</p>
                      <p className="font-medium">
                        {format(new Date(plan.last_performed_at), "d MMM yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  )}
                </div>
                {plan.checklist_items && plan.checklist_items.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Itens do checklist técnico</p>
                    <ul className="space-y-1">
                      {plan.checklist_items.map((item, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Fotos */}
      <PhotoSection
        orderId={order.id}
        photos={order.maintenance_photos}
        canEdit={canComplete}
      />

      {/* Custos */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <DollarSign className="w-4 h-4 text-primary" />
            Custos
          </h2>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setCostFormOpen(true)}>
            <Plus className="w-3 h-3" />
            Registrar
          </Button>
        </div>
        <Separator />
        {costsLoading ? (
          <div className="space-y-2">
            <CostCardSkeleton />
            <CostCardSkeleton />
          </div>
        ) : costs.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nenhum custo registrado.</p>
        ) : (
          <>
            <div className="space-y-2">
              {costs.map((cost) => (
                <CostCard
                  key={cost.id}
                  cost={cost}
                  currentUserId={currentUserId}
                  canApprove={canApprove}
                />
              ))}
            </div>

            {/* Totalizadores */}
            {(() => {
              const approved = costs.filter((c) => c.status === 'approved').reduce((s, c) => s + Number(c.amount), 0)
              const pending  = costs.filter((c) => c.status === 'pending').reduce((s, c) => s + Number(c.amount), 0)
              const estimate = order.cost_estimate ? Number(order.cost_estimate) : null
              const pct      = estimate && approved > 0 ? Math.min(Math.round((approved / estimate) * 100), 100) : null

              return (
                <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total aprovado</span>
                    <span className="font-semibold text-green-600 dark:text-green-400">{formatBRL(approved)}</span>
                  </div>
                  {pending > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pendente de aprovação</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">{formatBRL(pending)}</span>
                    </div>
                  )}
                  {estimate !== null && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Estimativa</span>
                        <span className="font-medium">{formatBRL(estimate)}</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Realizado</span>
                          <span>{pct ?? 0}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full transition-all duration-500"
                            style={{ width: `${pct ?? 0}%` }}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )
            })()}
          </>
        )}
      </div>

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

      <CostFormModal
        open={costFormOpen}
        onOpenChange={setCostFormOpen}
        preOrderId={order.id}
      />
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
