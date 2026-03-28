'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Bell, Calendar, RefreshCw, ClipboardList, CheckCircle2,
  AlertTriangle, CheckCheck, LucideIcon, X, Wrench, Settings,
  Clock, Archive, Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useNotifications } from '@/hooks/use-notifications'
import type { AppNotification } from '@/types/database.types'

// ── Type config ────────────────────────────────────────────────

type FilterTab = 'all' | 'event' | 'maintenance' | 'system'

const FILTER_LABELS: Record<FilterTab, string> = {
  all:         'Todas',
  event:       'Eventos',
  maintenance: 'Manutenção',
  system:      'Sistema',
}

const TYPE_ICON: Record<string, LucideIcon> = {
  event_created:            Calendar,
  event_status:             RefreshCw,
  event_tomorrow:           Bell,
  checklist_assigned:       ClipboardList,
  checklist_completed:      CheckCircle2,
  checklist_overdue:        AlertTriangle,
  maintenance_created:      Wrench,
  maintenance_emergency:    AlertTriangle,
  maintenance_status:       RefreshCw,
  maintenance_completed:    CheckCircle2,
  maintenance_overdue:      AlertTriangle,
  maintenance_due_soon:     Clock,
}

const TYPE_ICON_CLASS: Record<string, string> = {
  event_created:            'icon-brand',
  event_status:             'icon-blue',
  event_tomorrow:           'icon-amber',
  checklist_assigned:       'icon-brand',
  checklist_completed:      'icon-green',
  checklist_overdue:        'icon-red',
  maintenance_created:      'icon-amber',
  maintenance_emergency:    'icon-red',
  maintenance_status:       'icon-blue',
  maintenance_completed:    'icon-green',
  maintenance_overdue:      'icon-red',
  maintenance_due_soon:     'icon-orange',
}

function getFilterCategory(type: string): FilterTab {
  if (type.startsWith('event_') || type.startsWith('checklist_')) return 'event'
  if (type.startsWith('maintenance_')) return 'maintenance'
  return 'system'
}

// ── Sound helper ───────────────────────────────────────────────

function playBellSound() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.35)
  } catch {
    // AudioContext unavailable — silent fail
  }
}

// ── FilterChip ────────────────────────────────────────────────

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string
  count?: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={cn(
          'rounded-full text-[10px] font-bold px-1 min-w-[16px] text-center leading-4',
          active ? 'bg-white/20 text-white' : 'bg-primary/15 text-primary',
        )}>
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}

// ── NotificationItem ──────────────────────────────────────────

function NotificationItem({
  notification,
  isNew,
  onRead,
  onArchive,
}: {
  notification: AppNotification
  isNew: boolean
  onRead:    (id: string, link: string | null) => void
  onArchive: (id: string) => void
}) {
  const Icon      = TYPE_ICON[notification.type]      ?? Bell
  const iconClass = TYPE_ICON_CLASS[notification.type] ?? 'icon-gray'

  // Swipe state (mobile)
  const touchStartX    = useRef(0)
  const [swiped, setSwiped] = useState(false)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientX - touchStartX.current
    if (delta < -55) setSwiped(true)
    else if (delta > 20) setSwiped(false)
  }, [])

  const relative = formatDistanceToNow(new Date(notification.created_at), {
    addSuffix: true,
    locale: ptBR,
  })

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        isNew && 'animate-notification-in',
      )}
    >
      {/* ── Swipe action buttons (behind the item) ── */}
      <div className="absolute inset-y-0 right-0 flex items-stretch">
        <button
          onClick={() => { setSwiped(false); onRead(notification.id, null) }}
          className="w-14 flex flex-col items-center justify-center gap-0.5 bg-primary text-primary-foreground text-[10px] font-semibold"
          aria-label="Marcar como lida"
        >
          <Check className="w-4 h-4" />
          <span className="hidden sm:block">Lida</span>
        </button>
        <button
          onClick={() => { setSwiped(false); onArchive(notification.id) }}
          className="w-16 flex flex-col items-center justify-center gap-0.5 bg-destructive text-destructive-foreground text-[10px] font-semibold"
          aria-label="Arquivar"
        >
          <Archive className="w-4 h-4" />
          <span className="hidden sm:block">Arquivar</span>
        </button>
      </div>

      {/* ── Main item row ── */}
      <div
        className={cn(
          'group relative flex items-start gap-3 px-4 py-3',
          'transition-transform duration-200 ease-out',
          'cursor-pointer select-none',
          !notification.is_read
            ? 'bg-brand-50 dark:bg-primary/[0.06]'
            : 'bg-card hover:bg-muted/40',
          swiped && '-translate-x-[120px]',
        )}
        onClick={() => !swiped && onRead(notification.id, notification.link)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onRead(notification.id, notification.link)}
      >
        {/* Unread dot */}
        <span className={cn(
          'absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full transition-opacity',
          notification.is_read ? 'opacity-0' : 'bg-blue-500 opacity-100',
        )} />

        {/* Icon */}
        <div className={cn(
          'shrink-0 w-10 h-10 rounded-full flex items-center justify-center mt-0.5',
          iconClass,
        )}>
          <Icon className="w-4 h-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-sm leading-snug line-clamp-1',
            notification.is_read ? 'font-normal text-foreground' : 'font-medium text-foreground',
          )}>
            {notification.title}
          </p>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
            {notification.body}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">{relative}</p>
        </div>

        {/* Desktop hover actions (hidden on mobile via opacity) */}
        <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 self-center">
          {!notification.is_read && (
            <button
              onClick={(e) => { e.stopPropagation(); onRead(notification.id, null) }}
              title="Marcar como lida"
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onArchive(notification.id) }}
            title="Arquivar"
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border/50 mx-4" />
    </div>
  )
}

// ── NotificationPanel (slide-over) ────────────────────────────

function NotificationPanel({
  isOpen,
  onClose,
}: {
  isOpen: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const {
    notifications, unreadCount, isLoading, isError,
    markRead, markAllRead, isMarkingAll, deleteNotification, refetch,
  } = useNotifications()

  const [filter, setFilter]       = useState<FilterTab>('all')
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set())
  const [newIds, setNewIds]        = useState<Set<string>>(new Set())
  const archiveTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const prevIdsRef = useRef<Set<string>>(new Set())
  const isInitialLoad = useRef(true)

  // Track new notifications (for animation, skip initial load)
  useEffect(() => {
    if (!notifications.length && isInitialLoad.current) return

    const currentIds = new Set(notifications.map((n) => n.id))

    if (!isInitialLoad.current && prevIdsRef.current.size > 0) {
      const added = [...currentIds].filter((id) => !prevIdsRef.current.has(id))
      if (added.length > 0) {
        setNewIds(new Set(added))
        setTimeout(() => setNewIds(new Set()), 1200)
      }
    }

    prevIdsRef.current = currentIds
    isInitialLoad.current = false
  }, [notifications])

  // Cleanup timeouts on unmount
  useEffect(() => {
    const timeouts = archiveTimeouts.current
    return () => {
      timeouts.forEach((t) => clearTimeout(t))
    }
  }, [])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // ── Handlers ────────────────────────────────────────────────

  function handleRead(id: string, link: string | null) {
    markRead(id)
    if (link) {
      onClose()
      router.push(link)
    }
  }

  function handleArchive(id: string) {
    // Optimistic: hide immediately
    setArchivedIds((prev) => new Set([...prev, id]))

    const timeoutId = setTimeout(() => {
      deleteNotification(id)
      archiveTimeouts.current.delete(id)
    }, 4000)
    archiveTimeouts.current.set(id, timeoutId)

    toast('Notificação arquivada', {
      duration: 4000,
      action: {
        label: 'Desfazer',
        onClick: () => {
          const t = archiveTimeouts.current.get(id)
          if (t) { clearTimeout(t); archiveTimeouts.current.delete(id) }
          setArchivedIds((prev) => {
            const next = new Set(prev); next.delete(id); return next
          })
        },
      },
    })
  }

  // ── Filter ───────────────────────────────────────────────────

  const visibleNotifications = notifications.filter((n) => {
    if (archivedIds.has(n.id)) return false
    if (filter === 'all') return true
    return getFilterCategory(n.type) === filter
  })

  const filterCount = (tab: FilterTab) => {
    if (tab === 'all') return notifications.filter((n) => !n.is_read && !archivedIds.has(n.id)).length
    return notifications.filter(
      (n) => !n.is_read && !archivedIds.has(n.id) && getFilterCategory(n.type) === tab,
    ).length
  }

  return (
    <>
      {/* ── Overlay ── */}
      <div
        className={cn(
          'fixed inset-0 z-[9960] bg-black/50 transition-opacity duration-300',
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
        aria-hidden
      />

      {/* ── Panel ── */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-[9961] flex flex-col',
          'w-full sm:w-[380px]',
          'bg-card border-l border-border shadow-2xl',
          'transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        role="dialog"
        aria-label="Centro de notificações"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-foreground">Notificações</h2>
            {unreadCount > 0 && (
              <span className="text-[11px] font-bold bg-destructive text-white rounded-full px-1.5 py-0.5 leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllRead}
                disabled={isMarkingAll}
                className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Marcar todas</span>
              </Button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border overflow-x-auto shrink-0 no-scrollbar">
          {(['all', 'event', 'maintenance', 'system'] as FilterTab[]).map((tab) => (
            <FilterChip
              key={tab}
              label={FILTER_LABELS[tab]}
              count={filterCount(tab)}
              active={filter === tab}
              onClick={() => setFilter(tab)}
            />
          ))}
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">

          {/* Loading */}
          {isLoading && (
            <div>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {!isLoading && isError && (
            <div className="flex flex-col items-center gap-3 py-12 px-6 text-center">
              <AlertTriangle className="w-10 h-10 text-destructive/40" />
              <p className="text-sm font-medium text-foreground">Não foi possível carregar</p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Tentar novamente
              </Button>
            </div>
          )}

          {/* Empty */}
          {!isLoading && !isError && visibleNotifications.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-14 px-6 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500/40" />
              <p className="text-sm font-semibold text-foreground">Tudo em dia!</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {filter === 'all'
                  ? 'Nenhuma notificação pendente.'
                  : `Nenhuma notificação de ${FILTER_LABELS[filter].toLowerCase()}.`}
              </p>
            </div>
          )}

          {/* Items */}
          {!isLoading && !isError && visibleNotifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              isNew={newIds.has(n.id)}
              onRead={handleRead}
              onArchive={handleArchive}
            />
          ))}
        </div>

        {/* Footer */}
        {!isLoading && !isError && notifications.length > 0 && (
          <div className="shrink-0 border-t border-border px-4 py-2.5 text-center">
            <p className="text-[11px] text-muted-foreground/70">
              {visibleNotifications.length} de {notifications.length} notificações
            </p>
          </div>
        )}
      </div>
    </>
  )
}

// ── NotificationBell (main export) ────────────────────────────

export function NotificationBell() {
  const { unreadCount, notifications } = useNotifications()
  const [isOpen,   setIsOpen]   = useState(false)
  const [mounted,  setMounted]  = useState(false)
  const [isShaking, setIsShaking] = useState(false)

  const prevUnreadRef = useRef(0)
  const isOpenRef     = useRef(isOpen)
  isOpenRef.current   = isOpen

  useEffect(() => { setMounted(true) }, [])

  // Bell shake + sound when new unread arrives
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current && prevUnreadRef.current >= 0) {
      setIsShaking(true)
      setTimeout(() => setIsShaking(false), 700)
      if (!isOpenRef.current) playBellSound()
    }
    prevUnreadRef.current = unreadCount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount])

  // Auto-toast on new notification (panel closed)
  const prevNotifCountRef = useRef(0)
  useEffect(() => {
    if (!mounted) return
    if (notifications.length > prevNotifCountRef.current && prevNotifCountRef.current > 0) {
      if (!isOpenRef.current) {
        const newest = notifications[0]
        if (newest && !newest.is_read) {
          toast(newest.title, {
            description: newest.body,
            duration: 3000,
          })
        }
      }
    }
    prevNotifCountRef.current = notifications.length
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications, mounted])

  return (
    <>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          'relative p-2 rounded-lg text-muted-foreground',
          'hover:bg-accent hover:text-foreground',
          'transition-colors duration-150',
          'min-h-[44px] min-w-[44px] flex items-center justify-center',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        )}
        aria-label={unreadCount > 0 ? `${unreadCount} notificações não lidas` : 'Notificações'}
        aria-expanded={isOpen}
      >
        <Bell className={cn('w-5 h-5 transition-transform', isShaking && 'animate-bell-shake')} />
        {unreadCount > 0 && (
          <span
            className="absolute top-1.5 right-1.5 w-4 h-4 text-[10px] font-bold rounded-full bg-destructive text-white flex items-center justify-center leading-none"
            aria-hidden
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Slide-over panel via portal */}
      {mounted && createPortal(
        <NotificationPanel isOpen={isOpen} onClose={() => setIsOpen(false)} />,
        document.body,
      )}
    </>
  )
}
