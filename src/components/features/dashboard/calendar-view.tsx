'use client'

import { useMemo } from 'react'
import { format, addMonths, addWeeks, addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isToday } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarX, Wrench } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { CalendarEvent, CalendarMaintenance } from '@/hooks/use-dashboard'
import type { EventStatus, MaintenanceType } from '@/types/database.types'

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────
export type CalendarViewType = 'month' | 'week' | 'day'

interface CalendarViewProps {
  events: CalendarEvent[]
  maintenanceItems?: CalendarMaintenance[]
  showMaintenance?: boolean
  onToggleMaintenance?: () => void
  currentDate: Date
  view: CalendarViewType
  onDateChange: (date: Date) => void
  onViewChange: (view: CalendarViewType) => void
  onEventClick: (event: CalendarEvent) => void
  onMaintenanceClick?: (id: string) => void
  isLoading?: boolean
}

// ─────────────────────────────────────────────────────────────
// CORES POR STATUS
// ─────────────────────────────────────────────────────────────
const EVENT_PILL: Record<EventStatus, string> = {
  pending:     'bg-amber-100 text-amber-800 border-l-2 border-l-amber-400',
  confirmed:   'bg-blue-100 text-blue-800 border-l-2 border-l-blue-500',
  preparing:   'bg-purple-100 text-purple-800 border-l-2 border-l-purple-500',
  in_progress: 'bg-green-100 text-green-800 border-l-2 border-l-green-500',
  finished:    'bg-gray-100 text-gray-500 border-l-2 border-l-gray-300',
  post_event:  'bg-gray-50  text-gray-400 border-l-2 border-l-gray-200',
}

const EVENT_DOT: Record<EventStatus, string> = {
  pending:     'bg-amber-400',
  confirmed:   'bg-blue-500',
  preparing:   'bg-purple-500',
  in_progress: 'bg-green-500',
  finished:    'bg-gray-400',
  post_event:  'bg-gray-300',
}

const WEEK_HEADERS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const MAINTENANCE_PILL: Record<MaintenanceType, string> = {
  emergency: 'bg-red-100 text-red-800 border-l-2 border-l-red-500',
  punctual:  'bg-amber-100 text-amber-800 border-l-2 border-l-amber-500',
  recurring: 'bg-green-100 text-green-800 border-l-2 border-l-green-500',
}

const MAINTENANCE_DOT: Record<MaintenanceType, string> = {
  emergency: 'bg-red-500',
  punctual:  'bg-amber-500',
  recurring: 'bg-green-500',
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────
export function CalendarView({
  events,
  maintenanceItems = [],
  showMaintenance = true,
  onToggleMaintenance,
  currentDate,
  view,
  onDateChange,
  onViewChange,
  onEventClick,
  onMaintenanceClick,
  isLoading,
}: CalendarViewProps) {
  // Índice de eventos por data
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const ev of events) {
      if (!map[ev.date]) map[ev.date] = []
      map[ev.date].push(ev)
    }
    return map
  }, [events])

  // Índice de manutenções por data
  const maintenanceByDate = useMemo(() => {
    const map: Record<string, CalendarMaintenance[]> = {}
    for (const m of maintenanceItems) {
      if (!m.date) continue
      if (!map[m.date]) map[m.date] = []
      map[m.date].push(m)
    }
    return map
  }, [maintenanceItems])

  // Navegação
  function navigate(dir: 1 | -1) {
    if (view === 'month') onDateChange(addMonths(currentDate, dir))
    else if (view === 'week') onDateChange(addWeeks(currentDate, dir))
    else onDateChange(addDays(currentDate, dir))
  }

  function goToday() {
    onDateChange(new Date())
  }

  // Título do header
  function title() {
    if (view === 'month') {
      return format(currentDate, 'MMMM yyyy', { locale: ptBR })
    }
    if (view === 'week') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 })
      const we = endOfWeek(currentDate, { weekStartsOn: 1 })
      if (ws.getMonth() === we.getMonth()) {
        return `${format(ws, 'd')} – ${format(we, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`
      }
      return `${format(ws, "d MMM", { locale: ptBR })} – ${format(we, "d MMM yyyy", { locale: ptBR })}`
    }
    return format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR })
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* ── Header: nav + view toggle ── */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-1 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-muted transition-colors shrink-0"
            aria-label="Período anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <button
            onClick={goToday}
            className="text-sm font-semibold text-foreground capitalize hover:text-primary transition-colors truncate px-1"
            title="Clique para ir para hoje"
          >
            {title()}
          </button>

          <button
            onClick={() => navigate(1)}
            className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:bg-muted transition-colors shrink-0"
            aria-label="Próximo período"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Toggle manutenções */}
        {onToggleMaintenance && (
          <button
            onClick={onToggleMaintenance}
            title={showMaintenance ? 'Ocultar manutenções' : 'Mostrar manutenções'}
            className={cn(
              'flex items-center justify-center w-7 h-7 rounded-md transition-colors shrink-0',
              showMaintenance
                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                : 'text-muted-foreground hover:bg-muted'
            )}
          >
            <Wrench className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Toggle de visão */}
        <div className="flex items-center rounded-lg border border-border overflow-hidden shrink-0">
          {(['month', 'week', 'day'] as CalendarViewType[]).map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={cn(
                'px-2.5 py-1 text-xs font-medium transition-colors',
                view === v
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {v === 'month' ? 'Mês' : v === 'week' ? 'Sem.' : 'Dia'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : view === 'month' ? (
        <MonthView
          currentDate={currentDate}
          eventsByDate={eventsByDate}
          maintenanceByDate={showMaintenance ? maintenanceByDate : {}}
          onEventClick={onEventClick}
          onMaintenanceClick={onMaintenanceClick}
          onDayClick={(day) => { onDateChange(day); onViewChange('day') }}
        />
      ) : view === 'week' ? (
        <WeekView
          currentDate={currentDate}
          eventsByDate={eventsByDate}
          maintenanceByDate={showMaintenance ? maintenanceByDate : {}}
          onEventClick={onEventClick}
          onMaintenanceClick={onMaintenanceClick}
          onDayClick={(day) => { onDateChange(day); onViewChange('day') }}
        />
      ) : (
        <DayView
          currentDate={currentDate}
          eventsByDate={eventsByDate}
          maintenanceByDate={showMaintenance ? maintenanceByDate : {}}
          onEventClick={onEventClick}
          onMaintenanceClick={onMaintenanceClick}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// LOADING SKELETON
// ─────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="p-3 space-y-2 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-lg" />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// VISÃO MENSAL
// ─────────────────────────────────────────────────────────────
interface ViewProps {
  currentDate: Date
  eventsByDate: Record<string, CalendarEvent[]>
  maintenanceByDate: Record<string, CalendarMaintenance[]>
  onEventClick: (e: CalendarEvent) => void
  onMaintenanceClick?: (id: string) => void
  onDayClick: (day: Date) => void
}

function MonthView({ currentDate, eventsByDate, maintenanceByDate, onEventClick, onMaintenanceClick, onDayClick }: ViewProps) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd   = endOfMonth(currentDate)
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd    = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd })

  return (
    <div>
      {/* Cabeçalho dos dias da semana */}
      <div className="grid grid-cols-7 border-b border-border">
        {WEEK_HEADERS.map((h) => (
          <div key={h} className="py-2 text-center text-xs font-semibold text-muted-foreground">
            {h}
          </div>
        ))}
      </div>

      {/* Grid de dias */}
      <div className="grid grid-cols-7 divide-x divide-y divide-border">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const dayEvents = eventsByDate[key] ?? []
          const dayMaintenance = maintenanceByDate[key] ?? []
          const isCurrentMonth = isSameMonth(day, currentDate)
          const todayFlag = isToday(day)

          return (
            <div
              key={key}
              className={cn(
                'relative min-h-[72px] sm:min-h-[96px] p-1 transition-colors',
                !isCurrentMonth && 'bg-muted/30',
                todayFlag && 'bg-primary/5'
              )}
            >
              {/* Número do dia */}
              <button
                onClick={() => onDayClick(day)}
                className={cn(
                  'flex items-center justify-center w-6 h-6 text-xs font-medium rounded-full transition-colors mb-0.5',
                  todayFlag
                    ? 'bg-primary text-primary-foreground'
                    : isCurrentMonth
                      ? 'text-foreground hover:bg-muted'
                      : 'text-muted-foreground/50'
                )}
              >
                {format(day, 'd')}
              </button>

              {/* Eventos — dots no mobile, pills no sm+ */}
              {dayEvents.length > 0 && (
                <>
                  {/* Mobile: dots */}
                  <div className="flex flex-wrap gap-0.5 sm:hidden">
                    {dayEvents.slice(0, 5).map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => onEventClick(ev)}
                        className={cn('w-1.5 h-1.5 rounded-full', EVENT_DOT[ev.status])}
                        aria-label={ev.title}
                      />
                    ))}
                    {dayEvents.length > 5 && (
                      <span className="text-[9px] text-muted-foreground leading-none">+{dayEvents.length - 5}</span>
                    )}
                  </div>

                  {/* sm+: pills com texto */}
                  <div className="hidden sm:flex flex-col gap-0.5">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => onEventClick(ev)}
                        className={cn(
                          'w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded-sm truncate font-medium transition-opacity hover:opacity-80',
                          EVENT_PILL[ev.status]
                        )}
                        title={ev.title}
                      >
                        {ev.client_name || ev.title}
                      </button>
                    ))}
                    {dayEvents.length > 2 && (
                      <button
                        onClick={() => onDayClick(day)}
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors text-left px-1"
                      >
                        +{dayEvents.length - 2} mais
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* Manutenções */}
              {dayMaintenance.length > 0 && (
                <>
                  {/* Mobile: dots */}
                  <div className="flex flex-wrap gap-0.5 sm:hidden">
                    {dayMaintenance.slice(0, 3).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => onMaintenanceClick?.(m.id)}
                        className={cn('w-1.5 h-1.5 rounded-full', MAINTENANCE_DOT[m.type])}
                        aria-label={m.title}
                      />
                    ))}
                  </div>
                  {/* sm+: pills */}
                  <div className="hidden sm:flex flex-col gap-0.5">
                    {dayMaintenance.slice(0, 1).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => onMaintenanceClick?.(m.id)}
                        className={cn(
                          'w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded-sm truncate font-medium transition-opacity hover:opacity-80 flex items-center gap-0.5',
                          MAINTENANCE_PILL[m.type]
                        )}
                        title={m.title}
                      >
                        <Wrench className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{m.title}</span>
                      </button>
                    ))}
                    {dayMaintenance.length > 1 && (
                      <span className="text-[10px] text-muted-foreground px-1">
                        +{dayMaintenance.length - 1} manutenção
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// VISÃO SEMANAL
// ─────────────────────────────────────────────────────────────
function WeekView({ currentDate, eventsByDate, maintenanceByDate, onEventClick, onMaintenanceClick, onDayClick }: ViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd   = endOfWeek(currentDate, { weekStartsOn: 1 })
  const days      = eachDayOfInterval({ start: weekStart, end: weekEnd })

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[480px]">
        {/* Cabeçalho */}
        <div className="grid grid-cols-7 border-b border-border">
          {days.map((day) => {
            const todayFlag = isToday(day)
            return (
              <div key={day.toISOString()} className="py-2 text-center">
                <p className="text-xs text-muted-foreground">
                  {format(day, 'EEE', { locale: ptBR })}
                </p>
                <button
                  onClick={() => onDayClick(day)}
                  className={cn(
                    'inline-flex items-center justify-center w-7 h-7 mt-0.5 text-sm font-semibold rounded-full transition-colors',
                    todayFlag
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  {format(day, 'd')}
                </button>
              </div>
            )
          })}
        </div>

        {/* Eventos + Manutenções por dia */}
        <div className="grid grid-cols-7 divide-x divide-border min-h-[200px]">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const dayEvents = eventsByDate[key] ?? []
            const dayMaintenance = maintenanceByDate[key] ?? []

            return (
              <div key={key} className={cn('p-1 space-y-0.5', isToday(day) && 'bg-primary/5')}>
                {dayEvents.length === 0 && dayMaintenance.length === 0 && (
                  <div className="h-full" />
                )}
                {dayEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    className={cn(
                      'w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded-sm font-medium transition-opacity hover:opacity-80',
                      EVENT_PILL[ev.status]
                    )}
                    title={`${ev.start_time.slice(0,5)} – ${ev.title}`}
                  >
                    <span className="font-normal opacity-70">{ev.start_time.slice(0,5)}</span>{' '}
                    <span className="truncate block">{ev.client_name || ev.title}</span>
                  </button>
                ))}
                {dayMaintenance.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onMaintenanceClick?.(m.id)}
                    className={cn(
                      'w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded-sm font-medium transition-opacity hover:opacity-80 flex items-center gap-0.5',
                      MAINTENANCE_PILL[m.type]
                    )}
                    title={m.title}
                  >
                    <Wrench className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">{m.title}</span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// VISÃO DIÁRIA
// ─────────────────────────────────────────────────────────────
function DayView({ currentDate, eventsByDate, maintenanceByDate, onEventClick, onMaintenanceClick }: Omit<ViewProps, 'onDayClick'>) {
  const key = format(currentDate, 'yyyy-MM-dd')
  const dayEvents = eventsByDate[key] ?? []
  const dayMaintenance = maintenanceByDate[key] ?? []

  if (dayEvents.length === 0 && dayMaintenance.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
        <CalendarX className="w-8 h-8 opacity-40" />
        <p className="text-sm">Nenhum evento neste dia.</p>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2">
      {dayEvents.map((ev) => (
        <button
          key={ev.id}
          onClick={() => onEventClick(ev)}
          className={cn(
            'w-full text-left rounded-lg px-3 py-2.5 transition-opacity hover:opacity-80',
            EVENT_PILL[ev.status]
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold truncate">{ev.title}</p>
            <span className="text-xs opacity-70 shrink-0">
              {ev.start_time.slice(0,5)} – {ev.end_time.slice(0,5)}
            </span>
          </div>
          <p className="text-xs opacity-70 mt-0.5">{ev.client_name}</p>
          {(ev.event_type || ev.venue) && (
            <div className="flex items-center gap-2 mt-1 text-xs opacity-60">
              {ev.event_type && <span>{ev.event_type.name}</span>}
              {ev.event_type && ev.venue && <span>·</span>}
              {ev.venue && <span>{ev.venue.name}</span>}
            </div>
          )}
        </button>
      ))}
      {dayMaintenance.map((m) => (
        <button
          key={m.id}
          onClick={() => onMaintenanceClick?.(m.id)}
          className={cn(
            'w-full text-left rounded-lg px-3 py-2.5 transition-opacity hover:opacity-80',
            MAINTENANCE_PILL[m.type]
          )}
        >
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 shrink-0 opacity-70" />
            <p className="text-sm font-semibold truncate">{m.title}</p>
          </div>
          {m.sector && (
            <p className="text-xs opacity-70 mt-0.5 ml-6">{m.sector.name}</p>
          )}
        </button>
      ))}
    </div>
  )
}
