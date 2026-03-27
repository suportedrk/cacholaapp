'use client'

import { memo } from 'react'
import Link from 'next/link'
import { format, isPast, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AlertTriangle, Calendar, MapPin, User, Wrench } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/components/shared/user-avatar'
import { MaintenanceTypeBadge } from './maintenance-type-badge'
import { MaintenanceStatusBadge, MaintenancePriorityBadge } from './maintenance-status-badge'
import { cn } from '@/lib/utils'
import type { MaintenanceForList } from '@/types/database.types'

interface Props {
  order: MaintenanceForList
}

export const MaintenanceCard = memo(function MaintenanceCard({ order }: Props) {
  const isOverdue = !!(
    order.due_date &&
    order.status !== 'completed' &&
    order.status !== 'cancelled' &&
    isPast(parseISO(order.due_date))
  )

  return (
    <Link href={`/manutencao/${order.id}`} className="block group">
      <article className={cn(
        'bg-card rounded-xl border transition-all duration-150',
        'hover:shadow-md hover:-translate-y-0.5',
        'p-4 space-y-3',
        isOverdue
          ? 'border-red-300 bg-red-50/30'
          : 'border-border'
      )}>
        {/* Header: badges + alerta atrasado */}
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

        {/* Título */}
        <h3 className="font-semibold text-foreground text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {order.title}
        </h3>

        {/* Metadados */}
        <div className="space-y-1.5">
          {order.sector && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{order.sector.name}</span>
            </div>
          )}
          {order.equipment && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wrench className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{order.equipment.name}</span>
            </div>
          )}
          {order.due_date && (
            <div className={cn(
              'flex items-center gap-1.5 text-xs',
              isOverdue ? 'text-red-600 font-medium' : 'text-muted-foreground'
            )}>
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>
                {format(parseISO(order.due_date), "d 'de' MMM", { locale: ptBR })}
              </span>
            </div>
          )}
        </div>

        {/* Footer: responsável */}
        {order.assigned_user && (
          <div className="flex items-center gap-2 pt-1 border-t border-border/50">
            <UserAvatar name={order.assigned_user.name} avatarUrl={order.assigned_user.avatar_url} size="sm" />
            <span className="text-xs text-muted-foreground truncate">{order.assigned_user.name}</span>
            {order.photo_count > 0 && (
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {order.photo_count} foto{order.photo_count !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
        {!order.assigned_user && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
            <User className="w-3.5 h-3.5 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground/60 italic">Sem responsável</span>
          </div>
        )}
      </article>
    </Link>
  )
})

export function MaintenanceCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-14 rounded-full" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
        <Skeleton className="w-6 h-6 rounded-full" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  )
}
