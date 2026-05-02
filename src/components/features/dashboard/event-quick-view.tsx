'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowRight, Calendar, Clock, Tag } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
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
    <Dialog open={!!event} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogDescription className="sr-only">
          Resumo rápido do evento selecionado
        </DialogDescription>
        {event && (
          <>
            <DialogHeader className="pb-0">
              <div className="flex items-start gap-2 pr-8">
                <DialogTitle className="text-left text-base font-semibold leading-tight flex-1">
                  {event.title}
                </DialogTitle>
                <EventStatusBadge status={event.status} size="sm" className="shrink-0 mt-0.5" />
              </div>
              <p className="text-sm text-muted-foreground text-left">{event.client_name}</p>
            </DialogHeader>

            <div className="space-y-2.5">
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
              {event.birthday_person && (
                <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <Tag className="w-4 h-4 shrink-0" />
                  <span>{event.birthday_person}</span>
                </div>
              )}
              {event.birthday_person && (
                <p className="text-sm text-muted-foreground">
                  Aniversariante:{' '}
                  <span className="text-foreground font-medium">{event.birthday_person}</span>
                </p>
              )}
            </div>

            <DialogFooter className="flex-row gap-2">
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
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
