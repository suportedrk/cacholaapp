'use client'

import { memo } from 'react'
import Link from 'next/link'
import { format, isPast, parseISO, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  AlertTriangle, Calendar, MapPin, User, Wrench, Camera,
  Building2, DollarSign,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/components/shared/user-avatar'
import { MAINTENANCE_TYPE_CONFIG } from './maintenance-type-badge'
import { MaintenanceStatusBadge, MaintenancePriorityBadge } from './maintenance-status-badge'
import { cn } from '@/lib/utils'
import type { MaintenanceForList } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// SLA BAR CALCULATION
// ─────────────────────────────────────────────────────────────
function calcSla(order: MaintenanceForList): { pct: number; barColor: string } | null {
  if (!order.due_date || order.status === 'completed' || order.status === 'cancelled') return null
  const created = new Date(order.created_at).getTime()
  const due     = parseISO(order.due_date + 'T23:59:59').getTime()
  const now     = Date.now()
  if (now > due) return { pct: 100, barColor: 'bg-red-500' }
  const total = due - created
  if (total <= 0) return null
  const pct = Math.min(100, Math.max(2, ((now - created) / total) * 100))
  const barColor = pct >= 85 ? 'bg-orange-400' : pct >= 65 ? 'bg-amber-400' : 'bg-primary'
  return { pct, barColor }
}

// ─────────────────────────────────────────────────────────────
// CARD
// ─────────────────────────────────────────────────────────────
interface Props {
  order: MaintenanceForList
}

export const MaintenanceCard = memo(function MaintenanceCard({ order }: Props) {
  const typeCfg = MAINTENANCE_TYPE_CONFIG[order.type] ?? MAINTENANCE_TYPE_CONFIG.punctual
  const sla = calcSla(order)

  const isOverdue = !!(
    order.due_date &&
    order.status !== 'completed' &&
    order.status !== 'cancelled' &&
    isPast(parseISO(order.due_date))
  )

  const photoCount = order.photos?.length ?? order.photo_count ?? 0

  const relativeTime = formatDistanceToNow(parseISO(order.created_at), {
    locale: ptBR,
    addSuffix: true,
  })

  return (
    <Link href={`/manutencao/${order.id}`} className="block group">
      <article className={cn(
        'relative bg-card rounded-xl border card-interactive overflow-hidden',
        'flex flex-col',
        // border-left type accent
        'border-l-[3px]',
        typeCfg.borderLeft,
        isOverdue
          ? 'border-t-red-200 border-r-red-200 border-b-red-200 dark:border-t-red-900/40 dark:border-r-red-900/40 dark:border-b-red-900/40 bg-red-50/20 dark:bg-red-950/10'
          : 'border-t-border border-r-border border-b-border',
      )}>
        <div className="p-4 flex flex-col gap-2.5 flex-1">

          {/* ── Row 1: badges + relative time ──────────────────── */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Type pill */}
            <span className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
              typeCfg.pill,
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', typeCfg.dot)} />
              {typeCfg.label}
            </span>

            <MaintenancePriorityBadge priority={order.priority} />
            <MaintenanceStatusBadge  status={order.status} />

            {isOverdue && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium badge-red border">
                <AlertTriangle className="w-3 h-3" />
                Atrasada
              </span>
            )}

            <span className="ml-auto text-[10px] text-muted-foreground/70 shrink-0 whitespace-nowrap">
              {relativeTime}
            </span>
          </div>

          {/* ── Row 2: title ────────────────────────────────────── */}
          <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {order.title}
          </h3>

          {/* ── Row 3: meta ─────────────────────────────────────── */}
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {order.sector && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3 shrink-0" />
                {order.sector.name}
              </span>
            )}
            {order.equipment && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Wrench className="w-3 h-3 shrink-0" />
                {order.equipment.name}
              </span>
            )}
            {order.supplier && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="w-3 h-3 shrink-0" />
                {order.supplier.company_name}
              </span>
            )}
          </div>

          {/* ── Row 4: footer ──────────────────────────────────── */}
          <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border/50">
            {order.assigned_user ? (
              <>
                <UserAvatar
                  name={order.assigned_user.name}
                  avatarUrl={order.assigned_user.avatar_url}
                  size="sm"
                />
                <span className="text-xs text-muted-foreground truncate min-w-0">
                  {order.assigned_user.name}
                </span>
              </>
            ) : (
              <>
                <User className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                <span className="text-xs text-muted-foreground/60 italic">Sem responsável</span>
              </>
            )}

            {/* Right side: deadline + photo count + cost */}
            <div className="ml-auto flex items-center gap-2 shrink-0">
              {order.cost_estimate != null && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <DollarSign className="w-3 h-3" />
                  {order.cost_estimate.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              )}
              {photoCount > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Camera className="w-3 h-3" />
                  {photoCount}
                </span>
              )}
              {order.due_date && (
                <span className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-medium',
                  isOverdue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground',
                )}>
                  <Calendar className="w-3 h-3 shrink-0" />
                  {format(parseISO(order.due_date), "d MMM", { locale: ptBR })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── SLA bar (bottom) ─────────────────────────────────── */}
        {sla && (
          <div className="h-[3px] w-full bg-border/30">
            <div
              className={cn('h-full transition-all duration-700 ease-out', sla.barColor)}
              style={{ width: `${sla.pct}%` }}
            />
          </div>
        )}
      </article>
    </Link>
  )
})

// ─────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────
export function MaintenanceCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border border-l-[3px] border-l-border overflow-hidden">
      <div className="p-4 space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-3/4" />
        <div className="flex gap-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-border/50">
          <Skeleton className="w-6 h-6 rounded-full" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-12 ml-auto" />
        </div>
      </div>
      <div className="h-[3px] bg-border/30">
        <Skeleton className="h-full w-1/3" />
      </div>
    </div>
  )
}
