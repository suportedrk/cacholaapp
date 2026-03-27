'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Bell, Calendar, RefreshCw, ClipboardList, CheckCircle2,
  AlertTriangle, CheckCheck, LucideIcon,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/use-notifications'
import type { AppNotification } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// ÍCONES E CORES POR TIPO
// ─────────────────────────────────────────────────────────────
const TYPE_ICON: Record<string, LucideIcon> = {
  event_created:       Calendar,
  event_status:        RefreshCw,
  event_tomorrow:      Bell,
  checklist_assigned:  ClipboardList,
  checklist_completed: CheckCircle2,
  checklist_overdue:   AlertTriangle,
}

const TYPE_COLOR: Record<string, string> = {
  event_created:       'text-primary bg-primary/10',
  event_status:        'text-blue-600 bg-blue-50',
  event_tomorrow:      'text-amber-600 bg-amber-50',
  checklist_assigned:  'text-primary bg-primary/10',
  checklist_completed: 'text-green-600 bg-green-50',
  checklist_overdue:   'text-destructive bg-destructive/10',
}

// ─────────────────────────────────────────────────────────────
// ITEM DE NOTIFICAÇÃO
// ─────────────────────────────────────────────────────────────
function NotificationItem({
  notification,
  onRead,
}: {
  notification: AppNotification
  onRead: (id: string, link: string | null) => void
}) {
  const Icon = TYPE_ICON[notification.type] ?? Bell
  const colorClass = TYPE_COLOR[notification.type] ?? 'text-muted-foreground bg-muted'

  const relative = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: ptBR,
  })

  return (
    <button
      onClick={() => onRead(notification.id, notification.link)}
      className={cn(
        'w-full text-left flex items-start gap-3 px-4 py-3 transition-colors',
        'hover:bg-muted/50 focus-visible:outline-none focus-visible:bg-muted/50',
        !notification.is_read && 'bg-primary/5'
      )}
    >
      {/* Ícone do tipo */}
      <span className={cn('mt-0.5 shrink-0 w-7 h-7 rounded-full flex items-center justify-center', colorClass)}>
        <Icon className="w-3.5 h-3.5" />
      </span>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm leading-snug line-clamp-1',
          !notification.is_read ? 'font-medium text-foreground' : 'font-normal text-foreground'
        )}>
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {notification.body}
        </p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">{relative}</p>
      </div>

      {/* Indicador de não lida */}
      {!notification.is_read && (
        <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
      )}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────
export function NotificationBell() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const { notifications, unreadCount, isLoading, markRead, markAllRead, isMarkingAll } =
    useNotifications()

  useEffect(() => { setMounted(true) }, [])

  function handleRead(id: string, link: string | null) {
    markRead(id)
    if (link) router.push(link)
  }

  // Render a static placeholder until client mounts to avoid SSR/hydration mismatch
  // with @base-ui/react MenuPrimitive.Trigger
  if (!mounted) {
    return (
      <button
        className="relative p-2 rounded-lg text-muted-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
        aria-label="Notificações"
      >
        <Bell className="w-5 h-5" />
      </button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'relative p-2 rounded-lg text-muted-foreground',
          'hover:bg-accent hover:text-foreground',
          'transition-colors duration-150',
          'min-h-[44px] min-w-[44px] flex items-center justify-center',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
        )}
        aria-label={
          unreadCount > 0
            ? `${unreadCount} notificações não lidas`
            : 'Notificações'
        }
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1.5 right-1.5 w-4 h-4 text-[10px] font-bold rounded-full bg-destructive text-white flex items-center justify-center"
            aria-hidden="true"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 p-0 overflow-hidden"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllRead}
              disabled={isMarkingAll}
              className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Marcar todas como lidas
            </Button>
          )}
        </div>

        {/* Lista */}
        <div className="max-h-[420px] overflow-y-auto">
          {isLoading && (
            <div className="space-y-0">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <Skeleton className="w-7 h-7 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && notifications.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
              <Bell className="w-8 h-8 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground">Tudo em dia!</p>
              <p className="text-xs text-muted-foreground">
                Nenhuma notificação no momento.
              </p>
            </div>
          )}

          {!isLoading &&
            notifications.map((n, i) => (
              <div key={n.id}>
                {i > 0 && <DropdownMenuSeparator className="my-0" />}
                <NotificationItem notification={n} onRead={handleRead} />
              </div>
            ))}
        </div>

        {/* Footer: só aparece se tem notificações */}
        {!isLoading && notifications.length > 0 && (
          <>
            <DropdownMenuSeparator className="my-0" />
            <div className="px-4 py-2.5 text-center">
              <p className="text-xs text-muted-foreground">
                Mostrando as últimas {notifications.length} notificações
              </p>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
