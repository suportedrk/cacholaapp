import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarClock, ArrowRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { EventStatusBadge } from '@/components/shared/event-status-badge'
import { cn } from '@/lib/utils'
import type { EventWithDetails } from '@/types/database.types'

interface UpcomingEventsCardProps {
  events: EventWithDetails[]
  isLoading: boolean
  /** 'YYYY-MM-DD' de hoje, para marcar a linha do dia */
  todayStr: string
}

/**
 * Agenda compacta das próximas festas (glance), ao lado do NextEventCard.
 * Cada linha leva ao detalhe do evento. Estados loading/empty inclusos.
 */
export function UpcomingEventsCard({ events, isLoading, todayStr }: UpcomingEventsCardProps) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Próximas festas
        </h3>
        <Link href="/eventos" className="focus-ring -my-1 inline-flex items-center gap-1 rounded-md px-1 py-1 text-xs text-primary hover:underline">
          Ver todas <ArrowRight className="size-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2 pt-1">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-11 w-full rounded-lg" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <CalendarClock className="size-7 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-sm text-muted-foreground">Nenhuma festa próxima agendada.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {events.map((e) => {
            const d = new Date(`${e.date}T00:00:00`)
            const isToday = e.date === todayStr
            const range = [e.start_time?.slice(0, 5), e.end_time?.slice(0, 5)].filter(Boolean).join('–')
            return (
              <li key={e.id}>
                <Link
                  href={`/eventos/${e.id}`}
                  className="-mx-1 flex items-center gap-3 rounded-lg px-1 py-2.5 transition-colors hover:bg-muted/50"
                >
                  <div
                    className={cn(
                      'flex w-10 shrink-0 flex-col items-center justify-center rounded-md py-1',
                      isToday ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <span className="text-sm font-bold leading-none tabular-nums">{format(d, 'dd')}</span>
                    <span className="text-[10px] uppercase leading-none">{format(d, 'MMM', { locale: ptBR })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{e.client_name || e.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {isToday && <span className="font-medium text-primary">Hoje · </span>}
                      {range || 'horário a definir'}
                    </p>
                  </div>
                  <EventStatusBadge status={e.status} size="sm" showDot={false} className="shrink-0" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
