'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { isPast, isToday, format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  CalendarPlus, ClipboardList, CheckCircle2, PartyPopper,
  PackageCheck, ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/shared/user-avatar'
import type { EventWithDetails, ChecklistForList } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
type TimelineStatus = 'done' | 'current' | 'future'
type IconType = 'created' | 'checklist' | 'check-done' | 'event' | 'post'

type TimelineItem = {
  id: string
  title: string
  subtitle?: string
  timestamp?: Date
  status: TimelineStatus
  iconType: IconType
  user?: { name: string; avatar_url: string | null } | null
  link?: string
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
const DOT_CLASS: Record<TimelineStatus, string> = {
  done:    'bg-green-500 border-green-500',
  current: 'bg-primary border-primary animate-pulse',
  future:  'bg-muted border-border',
}

const DOT_ICON_CLASS: Record<TimelineStatus, string> = {
  done:    'text-white',
  current: 'text-primary-foreground',
  future:  'text-muted-foreground',
}

const ICON_MAP: Record<IconType, React.ElementType> = {
  created:    CalendarPlus,
  checklist:  ClipboardList,
  'check-done': CheckCircle2,
  event:      PartyPopper,
  post:       PackageCheck,
}

function formatTs(d: Date): string {
  return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

// ─────────────────────────────────────────────────────────────
// DERIVE TIMELINE FROM DATA
// ─────────────────────────────────────────────────────────────
function deriveTimeline(
  event: EventWithDetails,
  checklists: ChecklistForList[],
): TimelineItem[] {
  const items: TimelineItem[] = []
  const eventStart = new Date(`${event.date}T${event.start_time}`)
  const eventEnd   = new Date(`${event.date}T${event.end_time}`)
  const eventPast  = isPast(eventStart)
  const eventToday = isToday(parseISO(event.date))

  // 1. Evento criado / importado
  items.push({
    id: 'created',
    title: event.ploomes_deal_id ? 'Evento importado do Ploomes' : 'Evento criado',
    timestamp: new Date(event.created_at),
    status: 'done',
    iconType: 'created',
  })

  // 2. Checklists — sorted by created_at
  const sorted = [...checklists].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
  for (const cl of sorted) {
    items.push({
      id: `cl-${cl.id}`,
      title: `Checklist "${cl.title}" atribuído`,
      timestamp: new Date(cl.created_at),
      status: 'done',
      iconType: 'checklist',
      user: cl.assigned_user,
      link: `/checklists/${cl.id}`,
    })
    if (cl.status === 'completed') {
      items.push({
        id: `cl-done-${cl.id}`,
        title: `Checklist "${cl.title}" concluído`,
        timestamp: new Date(cl.updated_at),
        status: 'done',
        iconType: 'check-done',
        user: cl.assigned_user,
        link: `/checklists/${cl.id}`,
      })
    }
  }

  // 3. Data do evento
  items.push({
    id: 'event-day',
    title: eventPast
      ? 'Evento realizado'
      : eventToday
      ? 'Evento hoje!'
      : 'Data do evento',
    subtitle: format(eventStart, "EEEE, d 'de' MMMM", { locale: ptBR }),
    timestamp: eventStart,
    status: eventPast ? 'done' : 'future',
    iconType: 'event',
  })

  // 4. Pós-evento (only after event has started)
  if (eventPast) {
    items.push({
      id: 'post-event',
      title: 'Desmontagem / Pós-evento',
      timestamp: eventEnd,
      status: isPast(eventEnd) ? 'done' : 'current',
      iconType: 'post',
    })
  }

  // Sort by timestamp
  items.sort((a, b) => {
    if (!a.timestamp) return 1
    if (!b.timestamp) return -1
    return a.timestamp.getTime() - b.timestamp.getTime()
  })

  // Mark the first non-done item as 'current' if event hasn't happened yet
  if (!eventPast && !eventToday) {
    const firstFuture = items.find((i) => i.status === 'future')
    if (firstFuture) firstFuture.status = 'current'
  } else if (eventToday) {
    // Today: event-day is current
    const evItem = items.find((i) => i.id === 'event-day')
    if (evItem) evItem.status = 'current'
  }

  return items
}

// ─────────────────────────────────────────────────────────────
// DOT COMPONENT
// ─────────────────────────────────────────────────────────────
function TimelineDot({ status, iconType }: { status: TimelineStatus; iconType: IconType }) {
  const Icon = ICON_MAP[iconType]
  return (
    <div
      className={cn(
        'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2',
        DOT_CLASS[status],
        status === 'current' && 'shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-primary)_20%,transparent)]',
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', DOT_ICON_CLASS[status])} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
interface EventTimelineProps {
  event: EventWithDetails
  checklists: ChecklistForList[]
}

export function EventTimeline({ event, checklists }: EventTimelineProps) {
  const items = useMemo(() => deriveTimeline(event, checklists), [event, checklists])

  return (
    <div className="space-y-0">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1
        const inner = (
          <>
            {/* connector line */}
            {!isLast && (
              <div
                className={cn(
                  'absolute left-4 top-8 w-0.5 -translate-x-px',
                  'bottom-0',
                  item.status === 'done' ? 'bg-green-200 dark:bg-green-900' : 'bg-border',
                )}
              />
            )}

            {/* dot */}
            <TimelineDot status={item.status} iconType={item.iconType} />

            {/* content */}
            <div className={cn('flex-1 pb-6', isLast && 'pb-0')}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p
                    className={cn(
                      'text-sm font-medium leading-tight',
                      item.status === 'future' ? 'text-muted-foreground' : 'text-foreground',
                    )}
                  >
                    {item.title}
                    {item.link && (
                      <ExternalLink className="ml-1.5 inline h-3 w-3 text-muted-foreground" />
                    )}
                  </p>
                  {item.subtitle && (
                    <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                      {item.subtitle}
                    </p>
                  )}
                  {item.timestamp && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatTs(item.timestamp)}
                    </p>
                  )}
                </div>
                {item.user && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <UserAvatar
                      name={item.user.name}
                      avatarUrl={item.user.avatar_url}
                      size="sm"
                    />
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {item.user.name.split(' ')[0]}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </>
        )

        const wrapperClass = 'relative flex gap-3'

        return item.link ? (
          <Link
            key={item.id}
            href={item.link}
            className={cn(wrapperClass, 'group')}
          >
            {inner}
          </Link>
        ) : (
          <div key={item.id} className={wrapperClass}>
            {inner}
          </div>
        )
      })}
    </div>
  )
}
