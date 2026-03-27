'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowRight, Calendar, Clock, MapPin, Tag } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { EventStatusBadge } from '@/components/shared/event-status-badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CalendarEvent } from '@/hooks/use-dashboard'

interface EventQuickViewProps {
  event: CalendarEvent | null
  onClose: () => void
}

export function EventQuickView({ event, onClose }: EventQuickViewProps) {
  const formatTime = (t: string) => t.slice(0, 5)

  return (
    <Sheet open={!!event} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto sm:max-w-sm sm:rounded-xl">
        {event && (
          <>
            <SheetHeader className="pb-0">
              <div className="flex items-start gap-2 pr-8">
                <SheetTitle className="text-left text-base font-semibold leading-tight flex-1">
                  {event.title}
                </SheetTitle>
                <EventStatusBadge status={event.status} size="sm" className="shrink-0 mt-0.5" />
              </div>
              <p className="text-sm text-muted-foreground text-left">{event.client_name}</p>
            </SheetHeader>

            <div className="px-4 py-3 space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4 shrink-0" />
                <span className="capitalize">
                  {format(new Date(`${event.date}T00:00:00`), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <Clock className="w-4 h-4 shrink-0" />
                <span>{formatTime(event.start_time)} – {formatTime(event.end_time)}</span>
              </div>
              {event.venue && (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span>{event.venue.name}</span>
                </div>
              )}
              {event.event_type && (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Tag className="w-4 h-4 shrink-0" />
                  <span>{event.event_type.name}</span>
                </div>
              )}
              {event.birthday_person && (
                <p className="text-sm text-muted-foreground">
                  Aniversariante:{' '}
                  <span className="text-foreground font-medium">{event.birthday_person}</span>
                </p>
              )}
            </div>

            <SheetFooter className="flex-row gap-2">
              <Link
                href={`/eventos/${event.id}`}
                className={cn(
                  buttonVariants({ variant: 'default', size: 'default' }),
                  'flex-1 justify-between'
                )}
              >
                Ver evento completo
                <ArrowRight className="w-4 h-4" />
              </Link>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
