'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  CheckCircle2, Clock, DollarSign, Image, Plus, RefreshCw, AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/components/shared/user-avatar'
import type { AuditLogWithUser } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// UNIFIED EVENT TYPE
// ─────────────────────────────────────────────────────────────
type TimelineKind = 'audit' | 'cost' | 'photo'

interface TimelineEvent {
  id:        string
  kind:      TimelineKind
  createdAt: string
  // Audit
  action?:   string
  newData?:  Record<string, unknown> | null
  user?:     { name: string; avatar_url: string | null } | null
  // Cost
  costType?:     string
  costAmount?:   number
  costStatus?:   string
  costDesc?:     string
  // Photo
  photoType?:    string
}

const ACTION_LABEL: Record<string, string> = {
  // Valores do trigger PostgreSQL (TG_OP)
  insert: 'Ordem criada',
  update: 'Ordem atualizada',
  delete: 'Ordem excluída',
  // Valores de logAudit()
  create:     'Ordem criada',
  created:    'Ordem criada',
  updated:    'Ordem atualizada',
  deleted:    'Ordem excluída',
  activated:  'Registro ativado',
  deactivated: 'Registro desativado',
  permission_changed: 'Permissão alterada',
  status_change: 'Status alterado',
}

const STATUS_LABEL: Record<string, string> = {
  open:          'Aberta',
  in_progress:   'Em Andamento',
  waiting_parts: 'Aguard. Peças',
  completed:     'Concluída',
  cancelled:     'Cancelada',
}

const COST_TYPE_LABEL: Record<string, string> = {
  labor:     'Mão de Obra',
  material:  'Material',
  equipment: 'Equipamento',
  travel:    'Deslocamento',
  other:     'Outros',
}

const COST_STATUS_COLOR: Record<string, string> = {
  approved: 'text-green-600 dark:text-green-400',
  rejected: 'text-red-600 dark:text-red-400',
  pending:  'text-amber-600 dark:text-amber-400',
}

const PHOTO_TYPE_LABEL: Record<string, string> = {
  before: 'Antes',
  after:  'Depois',
  during: 'Durante',
}

// ─────────────────────────────────────────────────────────────
// ACTION BADGE (small icon overlaid on avatar, bottom-right)
// ─────────────────────────────────────────────────────────────
function AuditActionBadge({ action }: { action?: string }) {
  const a = (action ?? '').toLowerCase()
  const base = 'absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full ring-1 ring-background flex items-center justify-center'

  if (a === 'insert' || a === 'created') return (
    <span className={cn(base, 'bg-primary/10')}>
      <Plus className="w-2 h-2 text-primary" />
    </span>
  )
  if (a === 'delete' || a === 'deleted') return (
    <span className={cn(base, 'bg-red-100 dark:bg-red-900/30')}>
      <AlertCircle className="w-2 h-2 text-red-600 dark:text-red-400" />
    </span>
  )
  return (
    <span className={cn(base, 'bg-muted')}>
      <RefreshCw className="w-2 h-2 text-muted-foreground" />
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// DOT COMPONENT
// ─────────────────────────────────────────────────────────────
function TimelineDot({ kind, action }: { kind: TimelineKind; action?: string }) {
  const base = 'w-7 h-7 rounded-full flex items-center justify-center shrink-0 ring-2 ring-background'
  const a = (action ?? '').toLowerCase()

  if (kind === 'cost') return (
    <div className={cn(base, 'bg-green-100 dark:bg-green-900/30')}>
      <DollarSign className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
    </div>
  )
  if (kind === 'photo') return (
    <div className={cn(base, 'bg-blue-100 dark:bg-blue-900/30')}>
      <Image className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
    </div>
  )
  // Audit — normalize to lowercase (DB stores 'create'/'insert', 'delete')
  if (a === 'insert' || a === 'create' || a === 'created') return (
    <div className={cn(base, 'bg-primary/10')}>
      <Plus className="w-3.5 h-3.5 text-primary" />
    </div>
  )
  if (a === 'delete' || a === 'deleted') return (
    <div className={cn(base, 'bg-red-100 dark:bg-red-900/30')}>
      <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
    </div>
  )
  return (
    <div className={cn(base, 'bg-muted')}>
      <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SINGLE ITEM
// ─────────────────────────────────────────────────────────────
function TimelineItem({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const relativeTime = formatDistanceToNow(new Date(event.createdAt), { addSuffix: true, locale: ptBR })
  const absoluteTime = format(new Date(event.createdAt), "d MMM yyyy 'às' HH:mm", { locale: ptBR })
  const hasUserAvatar = event.kind === 'audit' && !!event.user
  const normalizedAction = (event.action ?? '').toLowerCase()

  function renderContent() {
    if (event.kind === 'cost') {
      const amount = event.costAmount !== undefined
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(event.costAmount)
        : null
      const statusLabel = event.costStatus === 'approved' ? 'aprovado'
        : event.costStatus === 'rejected' ? 'reprovado' : 'pendente'
      return (
        <p className="text-xs text-foreground">
          Custo registrado
          {event.costDesc && <span className="text-muted-foreground"> — {event.costDesc}</span>}
          {amount && (
            <span className={cn('font-semibold ml-1', COST_STATUS_COLOR[event.costStatus ?? 'pending'])}>
              {amount} ({statusLabel})
            </span>
          )}
          {event.costType && (
            <span className="text-muted-foreground ml-1">
              · {COST_TYPE_LABEL[event.costType] ?? event.costType}
            </span>
          )}
        </p>
      )
    }

    if (event.kind === 'photo') {
      const typeLabel = PHOTO_TYPE_LABEL[event.photoType ?? ''] ?? event.photoType
      return (
        <p className="text-xs text-foreground">
          Foto adicionada
          {typeLabel && <span className="text-muted-foreground"> — {typeLabel}</span>}
        </p>
      )
    }

    // Audit — normalize action to handle both INSERT/UPDATE/DELETE and created/updated/deleted
    const statusChange = (event.newData?.status as string | undefined)
    const isUpdate = normalizedAction === 'update' || normalizedAction === 'updated'

    if (isUpdate && statusChange) {
      const isCompletion = statusChange === 'completed'
      return (
        <p className="text-xs text-foreground">
          {isCompletion
            ? <><CheckCircle2 className="inline w-3 h-3 text-green-500 mr-0.5" /> Ordem concluída</>
            : <>Status alterado para <span className="font-medium">{STATUS_LABEL[statusChange] ?? statusChange}</span></>
          }
        </p>
      )
    }

    if (isUpdate) {
      const fields = Object.keys(event.newData ?? {}).filter((k) => k !== 'updated_at')
      const label = fields.length === 1
        ? `Campo "${fields[0]}" atualizado`
        : fields.length > 1 ? `${fields.length} campos atualizados` : 'Ordem atualizada'
      return <p className="text-xs text-foreground">{label}</p>
    }

    return (
      <p className="text-xs text-foreground">
        {ACTION_LABEL[normalizedAction] ?? 'Ação registrada'}
      </p>
    )
  }

  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center shrink-0">
        {/* Avatar in left col for audit events with user; icon dot for others */}
        {hasUserAvatar ? (
          <div className="relative shrink-0">
            <UserAvatar
              name={event.user!.name}
              avatarUrl={event.user!.avatar_url}
              size="sm"
            />
            <AuditActionBadge action={event.action} />
          </div>
        ) : (
          <TimelineDot kind={event.kind} action={event.action} />
        )}
        {!isLast && <div className="flex-1 w-0.5 bg-border mt-1 min-h-[1.5rem]" />}
      </div>

      <div className="flex-1 pb-4 min-w-0">
        {/* Actor name — avatar moved to left col, name stays in right col */}
        {event.user && (
          <span className="block text-[11px] font-medium text-foreground truncate mb-0.5">
            {event.user.name}
          </span>
        )}

        {renderContent()}

        {/* Timestamp */}
        <p className="text-[10px] text-muted-foreground mt-0.5" title={absoluteTime}>
          {relativeTime}
        </p>
      </div>
    </li>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
interface Props {
  orderId: string
}

export function MaintenanceTimeline({ orderId }: Props) {
  const { data: events, isLoading } = useQuery({
    queryKey: ['timeline', 'maintenance', orderId],
    enabled: !!orderId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const supabase = createClient()

      const [auditResult, costsResult, photosResult] = await Promise.all([
        supabase
          .from('audit_logs')
          .select('*, user:users!audit_logs_user_id_fkey(name, avatar_url)')
          .eq('entity_type', 'maintenance_orders')
          .eq('entity_id', orderId)
          .order('created_at', { ascending: false })
          .limit(30),

        supabase
          .from('maintenance_costs')
          .select('id, created_at, description, amount, cost_type, status')
          .eq('order_id', orderId)
          .order('created_at', { ascending: false })
          .limit(20),

        supabase
          .from('maintenance_photos')
          .select('id, created_at, type')
          .eq('order_id', orderId)
          .order('created_at', { ascending: false })
          .limit(20),
      ])

      const result: TimelineEvent[] = []

      for (const log of (auditResult.data ?? []) as unknown as AuditLogWithUser[]) {
        result.push({
          id:        log.id,
          kind:      'audit',
          createdAt: log.created_at,
          action:    log.action,
          newData:   log.new_data as Record<string, unknown> | null,
          user:      log.user,
        })
      }

      for (const cost of (costsResult.data ?? [])) {
        result.push({
          id:          cost.id,
          kind:        'cost',
          createdAt:   cost.created_at,
          costType:    cost.cost_type ?? undefined,
          costAmount:  cost.amount !== null ? Number(cost.amount) : undefined,
          costStatus:  cost.status ?? undefined,
          costDesc:    cost.description ?? undefined,
        })
      }

      for (const photo of (photosResult.data ?? [])) {
        result.push({
          id:         photo.id,
          kind:       'photo',
          createdAt:  photo.created_at,
          photoType:  photo.type ?? undefined,
        })
      }

      // Sort descending
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      return result
    },
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-7 h-7 rounded-full shrink-0" />
            <div className="space-y-1.5 flex-1 pt-1">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!events?.length) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground justify-center">
        <Clock className="w-4 h-4" />
        Nenhum histórico registrado.
      </div>
    )
  }

  return (
    <ol className="space-y-0">
      {events.map((event, idx) => (
        <TimelineItem
          key={event.id}
          event={event}
          isLast={idx === events.length - 1}
        />
      ))}
    </ol>
  )
}
