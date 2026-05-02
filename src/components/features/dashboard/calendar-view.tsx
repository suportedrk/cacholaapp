'use client'

import { useRouter } from 'next/navigation'

import React, { useEffect, useMemo, useState } from 'react'
import {
  format,
  addMonths, addWeeks, addDays,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  eachDayOfInterval,
  isSameMonth, isToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarX, Wrench, LayoutList, CalendarDays, ClipboardList, CheckSquare, Shield, Sparkles, Plus } from 'lucide-react'
import { CalendarExportButton } from './calendar-export'
import type { ExportPeriod } from './calendar-export'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { CalendarEvent, CalendarMaintenance } from '@/hooks/use-dashboard'
import type { CalendarChecklist } from '@/hooks/use-calendar-checklists'
import type { CalendarPreReserva } from '@/types/pre-reservas'
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
  checklistItems?: CalendarChecklist[]
  preReservaItems?: CalendarPreReserva[]
  onPreReservaClick?: (item: CalendarPreReserva) => void
  onNewPreReserva?: () => void
  canManagePreReservas?: boolean
  isLoading?: boolean
  activeUnitName?: string
  exportPeriod?: ExportPeriod
}

// ─────────────────────────────────────────────────────────────
// CORES POR STATUS (com dark mode)
// ─────────────────────────────────────────────────────────────
const EVENT_PILL: Record<EventStatus, string> = {
  pending:     'bg-amber-100 text-amber-800 border-l-2 border-l-amber-400 dark:bg-amber-950/50 dark:text-amber-300 dark:border-l-amber-600',
  confirmed:   'bg-blue-100 text-blue-800 border-l-2 border-l-blue-500 dark:bg-blue-950/50 dark:text-blue-300 dark:border-l-blue-600',
  preparing:   'bg-purple-100 text-purple-800 border-l-2 border-l-purple-500 dark:bg-purple-950/50 dark:text-purple-300 dark:border-l-purple-600',
  in_progress: 'bg-green-100 text-green-800 border-l-2 border-l-green-500 dark:bg-green-950/50 dark:text-green-300 dark:border-l-green-600',
  finished:    'bg-gray-100 text-gray-500 border-l-2 border-l-gray-300 dark:bg-gray-800/50 dark:text-gray-400 dark:border-l-gray-600',
  post_event:  'bg-gray-50 text-gray-400 border-l-2 border-l-gray-200 dark:bg-gray-800/30 dark:text-gray-500 dark:border-l-gray-700',
  lost:        'bg-gray-50 text-gray-400 border-l-2 border-l-gray-200 opacity-50 dark:bg-gray-800/30 dark:text-gray-500',
}

const EVENT_DOT: Record<EventStatus, string> = {
  pending:     'bg-amber-400',
  confirmed:   'bg-blue-500',
  preparing:   'bg-purple-500',
  in_progress: 'bg-green-500',
  finished:    'bg-gray-400',
  post_event:  'bg-gray-300',
  lost:        'bg-red-400 opacity-50',
}

const STATUS_LABEL: Record<EventStatus, string> = {
  pending:     'Pendente',
  confirmed:   'Confirmado',
  preparing:   'Preparando',
  in_progress: 'Em andamento',
  finished:    'Finalizado',
  post_event:  'Pós-evento',
  lost:        'Perdido',
}

const WEEK_HEADERS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const MAINTENANCE_PILL: Record<MaintenanceType, string> = {
  emergency:  'bg-red-100 text-red-800 border-l-2 border-l-red-500 dark:bg-red-950/50 dark:text-red-300 dark:border-l-red-600',
  preventive: 'bg-blue-100 text-blue-800 border-l-2 border-l-blue-500 dark:bg-blue-950/50 dark:text-blue-300 dark:border-l-blue-600',
  punctual:   'bg-amber-100 text-amber-800 border-l-2 border-l-amber-500 dark:bg-amber-950/50 dark:text-amber-300 dark:border-l-amber-600',
  recurring:  'bg-green-100 text-green-800 border-l-2 border-l-green-500 dark:bg-green-950/50 dark:text-green-300 dark:border-l-green-600',
}

const MAINTENANCE_DOT: Record<MaintenanceType, string> = {
  emergency:  'bg-red-500',
  preventive: 'bg-blue-500',
  punctual:   'bg-amber-500',
  recurring:  'bg-green-500',
}

const CHECKLIST_PILL = 'bg-purple-100 text-purple-800 border-l-2 border-l-purple-500 dark:bg-purple-900/40 dark:text-purple-300 dark:border-l-purple-600'
const CHECKLIST_DOT  = 'bg-purple-500'

const PRE_RESERVA_PILL        = 'bg-emerald-100 text-emerald-800 border-l-2 border-l-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-l-emerald-600'
const PRE_RESERVA_DOT         = 'bg-emerald-500'
const PRE_RESERVA_PLOOMES_PILL = 'bg-pink-100 text-pink-800 border-l-2 border-l-pink-500 dark:bg-pink-950/50 dark:text-pink-300 dark:border-l-pink-600'
const PRE_RESERVA_PLOOMES_DOT  = 'bg-pink-500'

function prPill(pr: CalendarPreReserva): string {
  return pr.source === 'ploomes' ? PRE_RESERVA_PLOOMES_PILL : PRE_RESERVA_PILL
}
function prDot(pr: CalendarPreReserva): string {
  return pr.source === 'ploomes' ? PRE_RESERVA_PLOOMES_DOT : PRE_RESERVA_DOT
}
function prIcon(pr: CalendarPreReserva): React.ReactElement {
  return pr.source === 'ploomes'
    ? <Sparkles className="w-3 h-3 shrink-0 opacity-70" />
    : <Shield   className="w-3 h-3 shrink-0 opacity-70" />
}
function prIconSm(pr: CalendarPreReserva): React.ReactElement {
  return pr.source === 'ploomes'
    ? <Sparkles className="w-2.5 h-2.5 shrink-0" />
    : <Shield   className="w-2.5 h-2.5 shrink-0" />
}

// ─────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────
export function CalendarView({
  events,
  maintenanceItems = [],
  showMaintenance = true,
  onToggleMaintenance: _onToggleMaintenance,
  currentDate,
  view,
  onDateChange,
  onViewChange,
  onEventClick,
  onMaintenanceClick,
  checklistItems = [],
  preReservaItems = [],
  onPreReservaClick,
  onNewPreReserva,
  canManagePreReservas = false,
  isLoading,
  activeUnitName,
  exportPeriod,
}: CalendarViewProps) {
  const router = useRouter()
  const [navDir, setNavDir] = useState<1 | -1 | 0>(0)
  const [mobileTab, setMobileTab] = useState<'cal' | 'list'>('cal')
  const [showEvents, setShowEvents] = useState(true)
  const [showMaintenanceInternal, setShowMaintenanceInternal] = useState(true)
  const [showChecklists, setShowChecklists] = useState(true)
  const [showPreReservas, setShowPreReservas] = useState(true)
  const [showPreReservasPloomes, setShowPreReservasPloomes] = useState(true)

  // Persistir filtros de tipo no localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('calendar-type-filters')
      if (saved) {
        const parsed = JSON.parse(saved) as {
          showEvents?: boolean
          showMaintenance?: boolean
          showChecklists?: boolean
          showPreReservas?: boolean
          prePloomes?: boolean
        }
        if (typeof parsed.showEvents === 'boolean') setShowEvents(parsed.showEvents)
        if (typeof parsed.showMaintenance === 'boolean') setShowMaintenanceInternal(parsed.showMaintenance)
        if (typeof parsed.showChecklists === 'boolean') setShowChecklists(parsed.showChecklists)
        if (typeof parsed.showPreReservas === 'boolean') setShowPreReservas(parsed.showPreReservas)
        if (typeof parsed.prePloomes === 'boolean') setShowPreReservasPloomes(parsed.prePloomes)
      }
    } catch { /* ignorar erro de parse */ }
  }, [])

  function saveFilters(ev: boolean, maint: boolean, chkl: boolean, pr: boolean, prPloomes: boolean) {
    try {
      localStorage.setItem('calendar-type-filters', JSON.stringify({
        showEvents: ev,
        showMaintenance: maint,
        showChecklists: chkl,
        showPreReservas: pr,
        prePloomes: prPloomes,
      }))
    } catch { /* ignorar */ }
  }

  function toggleShowEvents() {
    const next = !showEvents
    setShowEvents(next)
    saveFilters(next, showMaintenanceInternal, showChecklists, showPreReservas, showPreReservasPloomes)
  }

  function toggleShowMaintenanceInternal() {
    const next = !showMaintenanceInternal
    setShowMaintenanceInternal(next)
    saveFilters(showEvents, next, showChecklists, showPreReservas, showPreReservasPloomes)
  }

  function toggleShowChecklists() {
    const next = !showChecklists
    setShowChecklists(next)
    saveFilters(showEvents, showMaintenanceInternal, next, showPreReservas, showPreReservasPloomes)
  }

  function toggleShowPreReservas() {
    const next = !showPreReservas
    setShowPreReservas(next)
    saveFilters(showEvents, showMaintenanceInternal, showChecklists, next, showPreReservasPloomes)
  }

  function toggleShowPreReservasPloomes() {
    const next = !showPreReservasPloomes
    setShowPreReservasPloomes(next)
    saveFilters(showEvents, showMaintenanceInternal, showChecklists, showPreReservas, next)
  }

  const filteredEvents      = showEvents ? events : []
  const filteredMaintenance = (showMaintenanceInternal && showMaintenance) ? (maintenanceItems ?? []) : []
  const filteredChecklists  = showChecklists ? (checklistItems ?? []) : []
  const filteredPreReservas = useMemo(() => {
    const all = preReservaItems ?? []
    return all.filter((p) => {
      if (p.source === 'ploomes') return showPreReservasPloomes
      return showPreReservas
    })
  }, [preReservaItems, showPreReservas, showPreReservasPloomes])

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const ev of filteredEvents) {
      if (!map[ev.date]) map[ev.date] = []
      map[ev.date].push(ev)
    }
    return map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredEvents])

  const maintenanceByDate = useMemo(() => {
    const map: Record<string, CalendarMaintenance[]> = {}
    for (const m of filteredMaintenance) {
      if (!m.date) continue
      if (!map[m.date]) map[m.date] = []
      map[m.date].push(m)
    }
    return map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredMaintenance])

  const checklistByDate = useMemo(() => {
    const map: Record<string, CalendarChecklist[]> = {}
    for (const c of filteredChecklists) {
      if (!c.date) continue
      if (!map[c.date]) map[c.date] = []
      map[c.date].push(c)
    }
    return map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredChecklists])

  const preReservaByDate = useMemo(() => {
    const map: Record<string, CalendarPreReserva[]> = {}
    for (const p of filteredPreReservas) {
      if (!p.date) continue
      if (!map[p.date]) map[p.date] = []
      map[p.date].push(p)
    }
    return map
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredPreReservas])

  function navigate(dir: 1 | -1) {
    setNavDir(dir)
    if (view === 'month') onDateChange(addMonths(currentDate, dir))
    else if (view === 'week') onDateChange(addWeeks(currentDate, dir))
    else onDateChange(addDays(currentDate, dir))
  }

  function goToday() {
    const now = new Date()
    setNavDir(now > currentDate ? 1 : -1)
    onDateChange(now)
  }

  const now = new Date()
  const isAtCurrentPeriod =
    view === 'month'
      ? currentDate.getMonth() === now.getMonth() && currentDate.getFullYear() === now.getFullYear()
      : view === 'week'
        ? format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd') ===
          format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
        : format(currentDate, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd')

  function headerTitle() {
    if (view === 'month') return format(currentDate, 'MMMM yyyy', { locale: ptBR })
    if (view === 'week') {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 })
      const we = endOfWeek(currentDate, { weekStartsOn: 1 })
      if (ws.getMonth() === we.getMonth()) {
        return `${format(ws, 'd')} – ${format(we, "d 'de' MMMM 'de' yyyy", { locale: ptBR })}`
      }
      return `${format(ws, 'd MMM', { locale: ptBR })} – ${format(we, 'd MMM yyyy', { locale: ptBR })}`
    }
    return format(currentDate, "EEEE, d 'de' MMMM", { locale: ptBR })
  }

  const visibleEventCount =
    filteredEvents.filter((e) => e.status !== 'lost').length +
    filteredPreReservas.length

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border">
        {/* Prev */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-muted transition-colors shrink-0"
          aria-label="Período anterior"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Title + count badge */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground capitalize truncate">
            {headerTitle()}
          </span>
          {view === 'month' && visibleEventCount > 0 && (
            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary leading-none">
              {visibleEventCount} evento{visibleEventCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Next */}
        <button
          onClick={() => navigate(1)}
          className="flex items-center justify-center w-8 h-8 rounded-md text-muted-foreground hover:bg-muted transition-colors shrink-0"
          aria-label="Próximo período"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Hoje — só aparece quando não está no período atual */}
        {!isAtCurrentPeriod && (
          <button
            onClick={goToday}
            className="hidden sm:flex items-center text-xs font-medium px-2.5 h-7 rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
          >
            Hoje
          </button>
        )}

        {/* Mobile: toggle calendário/lista */}
        <div className="flex sm:hidden items-center rounded-lg border border-border overflow-hidden shrink-0">
          <button
            onClick={() => setMobileTab('cal')}
            className={cn(
              'flex items-center justify-center w-8 h-7 transition-colors',
              mobileTab === 'cal'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
            aria-label="Calendário"
          >
            <CalendarDays className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setMobileTab('list')}
            className={cn(
              'flex items-center justify-center w-8 h-7 transition-colors',
              mobileTab === 'list'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            )}
            aria-label="Lista"
          >
            <LayoutList className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* View toggle — desktop */}
        <div className="hidden sm:flex items-center rounded-lg border border-border overflow-hidden shrink-0">
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

      {/* ── Filtros de tipo ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-wrap">
        <button
          onClick={toggleShowEvents}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all',
            showEvents
              ? 'bg-blue-500/20 border-blue-500 text-blue-600 dark:text-blue-400'
              : 'bg-muted/50 border-border text-text-tertiary opacity-60'
          )}
        >
          <CalendarDays className="w-3 h-3" />
          Eventos
        </button>
        <button
          onClick={toggleShowMaintenanceInternal}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all',
            showMaintenanceInternal
              ? 'bg-amber-500/20 border-amber-500 text-amber-600 dark:text-amber-400'
              : 'bg-muted/50 border-border text-text-tertiary opacity-60'
          )}
        >
          <Wrench className="w-3 h-3" />
          Manutenção
        </button>
        {checklistItems !== undefined && (
          <button
            onClick={toggleShowChecklists}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all',
              showChecklists
                ? 'bg-purple-500/20 border-purple-500 text-purple-600 dark:text-purple-400'
                : 'bg-muted/50 border-border text-text-tertiary opacity-60'
            )}
          >
            <CheckSquare className="w-3 h-3" />
            Checklists
          </button>
        )}
        {preReservaItems !== undefined && (
          <button
            onClick={toggleShowPreReservas}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all',
              showPreReservas
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'bg-muted/50 border-border text-text-tertiary opacity-60'
            )}
          >
            <Shield className="w-3 h-3" />
            Pré-venda
          </button>
        )}
        {preReservaItems !== undefined && (
          <button
            onClick={toggleShowPreReservasPloomes}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all',
              showPreReservasPloomes
                ? 'bg-pink-500/20 border-pink-500 text-pink-600 dark:text-pink-400'
                : 'bg-muted/50 border-border text-text-tertiary opacity-60'
            )}
          >
            <Sparkles className="w-3 h-3" />
            Pré-reserva Ploomes
          </button>
        )}

        {/* Botão "Enviar ao cliente" — exporta PNG do calendário */}
        {exportPeriod && (
          <CalendarExportButton
            events={events}
            preReservas={preReservaItems}
            unitName={activeUnitName ?? 'Cachola'}
            period={exportPeriod}
            disabled={isLoading}
          />
        )}

        {/* Botão "Nova Pré-reserva" — só para super_admin/diretor */}
        {canManagePreReservas && onNewPreReserva && (
          <button
            onClick={onNewPreReserva}
            className="ml-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all bg-emerald-500 border-emerald-600 text-white hover:bg-emerald-600"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">Nova Pré-venda</span>
            <span className="sm:hidden">Pré-reserva</span>
          </button>
        )}
      </div>

      {/* ── Body ── */}
      {isLoading ? (
        <CalendarSkeleton />
      ) : (
        <>
          {/* Mobile lista */}
          <div className={cn('sm:hidden', mobileTab !== 'list' && 'hidden')}>
            <ListView
              events={filteredEvents}
              maintenanceItems={filteredMaintenance}
              checklistItems={filteredChecklists}
              preReservaItems={filteredPreReservas}
              onEventClick={onEventClick}
              onMaintenanceClick={onMaintenanceClick}
              onChecklistClick={(url) => router.push(url)}
              onPreReservaClick={onPreReservaClick}
            />
          </div>

          {/* Visões de calendário */}
          <div className={cn(mobileTab === 'list' && 'hidden sm:block')}>
            {view === 'month' ? (
              <MonthView
                key={format(currentDate, 'yyyy-MM')}
                navDir={navDir}
                currentDate={currentDate}
                eventsByDate={eventsByDate}
                maintenanceByDate={maintenanceByDate}
                checklistByDate={checklistByDate}
                preReservaByDate={preReservaByDate}
                onEventClick={onEventClick}
                onMaintenanceClick={onMaintenanceClick}
                onChecklistClick={(url) => router.push(url)}
                onPreReservaClick={onPreReservaClick}
                onDayClick={(day) => { onDateChange(day); onViewChange('day') }}
              />
            ) : view === 'week' ? (
              <WeekView
                key={format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd')}
                currentDate={currentDate}
                eventsByDate={eventsByDate}
                maintenanceByDate={maintenanceByDate}
                checklistByDate={checklistByDate}
                preReservaByDate={preReservaByDate}
                onEventClick={onEventClick}
                onMaintenanceClick={onMaintenanceClick}
                onChecklistClick={(url) => router.push(url)}
                onPreReservaClick={onPreReservaClick}
                onDayClick={(day) => { onDateChange(day); onViewChange('day') }}
              />
            ) : (
              <DayView
                currentDate={currentDate}
                eventsByDate={eventsByDate}
                maintenanceByDate={maintenanceByDate}
                checklistByDate={checklistByDate}
                preReservaByDate={preReservaByDate}
                onEventClick={onEventClick}
                onMaintenanceClick={onMaintenanceClick}
                onChecklistClick={(url) => router.push(url)}
                onPreReservaClick={onPreReservaClick}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// LOADING SKELETON
// ─────────────────────────────────────────────────────────────
function CalendarSkeleton() {
  return (
    <div className="p-3 space-y-2">
      {/* Week headers */}
      <div className="grid grid-cols-7 gap-1 mb-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full rounded skeleton-shimmer" />
        ))}
      </div>
      {/* Day cells */}
      {Array.from({ length: 5 }).map((_, row) => (
        <div key={row} className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, col) => (
            <Skeleton key={col} className="h-14 sm:h-20 w-full rounded-lg skeleton-shimmer" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// POPOVER CONTEÚDO DO DIA
// ─────────────────────────────────────────────────────────────
function DayPopoverContent({
  day,
  dayEvents,
  dayMaintenance,
  dayChecklists = [],
  dayPreReservas = [],
  onEventClick,
  onMaintenanceClick,
  onChecklistClick,
  onPreReservaClick,
  onDayClick,
}: {
  day: Date
  dayEvents: CalendarEvent[]
  dayMaintenance: CalendarMaintenance[]
  dayChecklists?: CalendarChecklist[]
  dayPreReservas?: CalendarPreReserva[]
  onEventClick: (e: CalendarEvent) => void
  onMaintenanceClick?: (id: string) => void
  onChecklistClick?: (url: string) => void
  onPreReservaClick?: (item: CalendarPreReserva) => void
  onDayClick: (day: Date) => void
}) {
  const activeEvents = dayEvents.filter((e) => e.status !== 'lost')
  const lostEvents   = dayEvents.filter((e) => e.status === 'lost')

  return (
    <div className="space-y-1">
      {/* Header do popover */}
      <div className="flex items-center justify-between pb-1.5 mb-0.5 border-b border-border">
        <p className="text-xs font-semibold text-foreground capitalize">
          {format(day, "d 'de' MMMM", { locale: ptBR })}
        </p>
        <button
          onClick={() => onDayClick(day)}
          className="text-[10px] font-medium text-primary hover:underline shrink-0"
        >
          ver dia
        </button>
      </div>

      {/* Eventos ativos */}
      {activeEvents.map((ev) => (
        <button
          key={ev.id}
          onClick={() => onEventClick(ev)}
          className={cn(
            'w-full text-left text-xs rounded-md px-2 py-1.5 transition-opacity hover:opacity-80',
            EVENT_PILL[ev.status]
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium truncate">{ev.client_name || ev.title}</span>
            {ev.start_time && (
              <span className="shrink-0 opacity-70 font-normal">{ev.start_time.slice(0, 5)}</span>
            )}
          </div>
        </button>
      ))}

      {/* Manutenções */}
      {dayMaintenance.map((m) => (
        <button
          key={m.id}
          onClick={() => onMaintenanceClick?.(m.id)}
          className={cn(
            'w-full text-left text-xs rounded-md px-2 py-1.5 transition-opacity hover:opacity-80 flex items-center gap-1.5',
            MAINTENANCE_PILL[m.type]
          )}
        >
          <Wrench className="w-3 h-3 shrink-0 opacity-70" />
          <span className="truncate font-medium">{m.title}</span>
          {m.sector && <span className="ml-auto shrink-0 opacity-60">{m.sector.name}</span>}
        </button>
      ))}

      {/* Checklists */}
      {dayChecklists.map((c) => (
        <button
          key={c.id}
          onClick={() => onChecklistClick?.(c.url)}
          className={cn(
            'w-full text-left text-xs rounded-md px-2 py-1.5 transition-opacity hover:opacity-80 flex items-center gap-1.5',
            CHECKLIST_PILL
          )}
        >
          <ClipboardList className="w-3 h-3 shrink-0 opacity-70" />
          <span className="truncate font-medium">{c.title}</span>
        </button>
      ))}

      {/* Pré-reservas */}
      {dayPreReservas.map((p) => (
        <button
          key={p.id}
          onClick={() => onPreReservaClick?.(p)}
          className={cn(
            'w-full text-left text-xs rounded-md px-2 py-1.5 transition-opacity hover:opacity-80 flex items-center gap-1.5',
            prPill(p)
          )}
        >
          {prIcon(p)}
          <span className="truncate font-medium">{p.title}</span>
          {(p.start_time || p.end_time) && (
            <span className="ml-auto shrink-0 opacity-60">
              {p.start_time ?? '—'}{p.end_time ? `→${p.end_time}` : ''}
            </span>
          )}
        </button>
      ))}

      {/* Perdidos */}
      {lostEvents.length > 0 && (
        <p className="text-[10px] text-muted-foreground pt-0.5">
          +{lostEvents.length} evento{lostEvents.length !== 1 ? 's' : ''} perdido{lostEvents.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// NUMERO DO DIA (com ou sem popover)
// ─────────────────────────────────────────────────────────────
function DayNumber({
  day,
  todayFlag,
  isCurrentMonth,
  hasEvents,
  dayEvents,
  dayMaintenance,
  dayChecklists = [],
  dayPreReservas = [],
  onEventClick,
  onMaintenanceClick,
  onChecklistClick,
  onPreReservaClick,
  onDayClick,
}: {
  day: Date
  todayFlag: boolean
  isCurrentMonth: boolean
  hasEvents: boolean
  dayEvents: CalendarEvent[]
  dayMaintenance: CalendarMaintenance[]
  dayChecklists?: CalendarChecklist[]
  dayPreReservas?: CalendarPreReserva[]
  onEventClick: (e: CalendarEvent) => void
  onMaintenanceClick?: (id: string) => void
  onChecklistClick?: (url: string) => void
  onPreReservaClick?: (item: CalendarPreReserva) => void
  onDayClick: (day: Date) => void
}) {
  const dayNumberClass = cn(
    'flex items-center justify-center w-7 h-7 text-xs font-medium rounded-full transition-colors mb-0.5',
    todayFlag
      ? 'bg-primary text-primary-foreground dark:bg-transparent dark:ring-2 dark:ring-primary dark:text-primary'
      : isCurrentMonth
        ? 'text-foreground hover:bg-muted'
        : 'text-muted-foreground/40'
  )

  if (!hasEvents) {
    return (
      <button onClick={() => onDayClick(day)} className={dayNumberClass}>
        {format(day, 'd')}
      </button>
    )
  }

  return (
    <Popover>
      <PopoverTrigger
        render={<button className={dayNumberClass} aria-label={`Ver eventos de ${format(day, 'd')}`} />}
      >
        {format(day, 'd')}
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-64 p-2">
        <DayPopoverContent
          day={day}
          dayEvents={dayEvents}
          dayMaintenance={dayMaintenance}
          dayChecklists={dayChecklists}
          dayPreReservas={dayPreReservas}
          onEventClick={onEventClick}
          onMaintenanceClick={onMaintenanceClick}
          onChecklistClick={onChecklistClick}
          onPreReservaClick={onPreReservaClick}
          onDayClick={onDayClick}
        />
      </PopoverContent>
    </Popover>
  )
}

// ─────────────────────────────────────────────────────────────
// VISÃO MENSAL
// ─────────────────────────────────────────────────────────────
interface ViewProps {
  currentDate: Date
  eventsByDate: Record<string, CalendarEvent[]>
  maintenanceByDate: Record<string, CalendarMaintenance[]>
  checklistByDate?: Record<string, CalendarChecklist[]>
  preReservaByDate?: Record<string, CalendarPreReserva[]>
  onEventClick: (e: CalendarEvent) => void
  onMaintenanceClick?: (id: string) => void
  onChecklistClick?: (url: string) => void
  onPreReservaClick?: (item: CalendarPreReserva) => void
  onDayClick: (day: Date) => void
}

function formatHHMM(t: string | null | undefined): string | null {
  if (!t) return null
  return t.slice(0, 5)
}

function formatEventTimeRange(ev: CalendarEvent): string | null {
  const s = formatHHMM(ev.start_time)
  const e = formatHHMM(ev.end_time)
  if (!s && !e) return null
  if (s && e) return `${s} – ${e}`
  return s ?? e
}

function MonthView({
  navDir,
  currentDate,
  eventsByDate,
  maintenanceByDate,
  checklistByDate = {},
  preReservaByDate = {},
  onEventClick,
  onMaintenanceClick,
  onChecklistClick,
  onPreReservaClick,
  onDayClick,
}: ViewProps & { navDir: 1 | -1 | 0 }) {
  const monthStart = startOfMonth(currentDate)
  const monthEnd   = endOfMonth(currentDate)
  const gridStart  = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd    = endOfWeek(monthEnd,   { weekStartsOn: 1 })
  const days       = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const animClass =
    navDir === 1  ? 'animate-slide-left-in' :
    navDir === -1 ? 'animate-slide-right-in' :
    'animate-page-enter'

  return (
    <div className={animClass}>
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
          const key          = format(day, 'yyyy-MM-dd')
          const dayEvents    = eventsByDate[key] ?? []
          const dayMaint     = maintenanceByDate[key] ?? []
          const dayChklists  = checklistByDate[key] ?? []
          const dayPreRes    = preReservaByDate[key] ?? []
          const inMonth      = isSameMonth(day, currentDate)
          const todayFlag    = isToday(day)
          const activeEvents = dayEvents.filter((e) => e.status !== 'lost')
          const isBusy       = activeEvents.length >= 3
          const hasEvents    = dayEvents.length > 0 || dayMaint.length > 0 || dayChklists.length > 0 || dayPreRes.length > 0

          return (
            <div
              key={key}
              className={cn(
                'relative min-h-[72px] sm:min-h-[96px] p-1.5 transition-colors',
                'hover:bg-muted/30',
                !inMonth && 'bg-muted/20',
                todayFlag && 'bg-[var(--color-brand-50)] dark:bg-[oklch(0.260_0.040_144_/_0.15)]',
                isBusy && !todayFlag && 'border-l-2 border-l-primary/40 bg-primary/[0.03]',
              )}
            >
              {/* Número do dia */}
              <DayNumber
                day={day}
                todayFlag={todayFlag}
                isCurrentMonth={inMonth}
                hasEvents={hasEvents}
                dayEvents={dayEvents}
                dayMaintenance={dayMaint}
                dayChecklists={dayChklists}
                dayPreReservas={dayPreRes}
                onEventClick={onEventClick}
                onMaintenanceClick={onMaintenanceClick}
                onChecklistClick={onChecklistClick}
                onPreReservaClick={onPreReservaClick}
                onDayClick={onDayClick}
              />

              {/* Mobile: dots */}
              <div className="flex flex-wrap gap-[3px] sm:hidden mt-0.5">
                {dayEvents.slice(0, 3).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    className={cn(
                      'w-1.5 h-1.5 rounded-full min-w-[6px] min-h-[6px]',
                      EVENT_DOT[ev.status]
                    )}
                    aria-label={ev.title}
                  />
                ))}
                {dayMaint.slice(0, 2).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => onMaintenanceClick?.(m.id)}
                    className={cn(
                      'w-1.5 h-1.5 rounded-full min-w-[6px] min-h-[6px]',
                      MAINTENANCE_DOT[m.type]
                    )}
                    aria-label={m.title}
                  />
                ))}
                {dayChklists.slice(0, 1).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onChecklistClick?.(c.url)}
                    className={cn('w-1.5 h-1.5 rounded-full min-w-[6px] min-h-[6px]', CHECKLIST_DOT)}
                    aria-label={c.title}
                  />
                ))}
                {dayPreRes.slice(0, 1).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onPreReservaClick?.(p)}
                    className={cn('w-1.5 h-1.5 rounded-full min-w-[6px] min-h-[6px]', prDot(p))}
                    aria-label={p.title}
                  />
                ))}
                {dayEvents.length + dayMaint.length + dayChklists.length + dayPreRes.length > 6 && (
                  <span className="text-[9px] text-muted-foreground leading-none self-center">
                    +{dayEvents.length + dayMaint.length + dayChklists.length + dayPreRes.length - 6}
                  </span>
                )}
              </div>

              {/* Desktop: pills */}
              <div className="hidden sm:flex flex-col gap-0.5">
                {activeEvents.slice(0, 2).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    className={cn(
                      'w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded-sm font-medium transition-opacity hover:opacity-80',
                      EVENT_PILL[ev.status]
                    )}
                    title={[ev.client_name || ev.title, ev.owner_name].filter(Boolean).join(' · ')}
                  >
                    <span className="truncate block">{ev.client_name || ev.title}</span>
                    {(() => {
                      const timeRange = formatEventTimeRange(ev)
                      return timeRange ? (
                        <span className="block text-[9px] opacity-70 leading-tight truncate">{timeRange}</span>
                      ) : null
                    })()}
                  </button>
                ))}
                {/* Lost events: visual distinto */}
                {dayEvents.filter((e) => e.status === 'lost').slice(0, 1).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    className={cn(
                      'w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded-sm font-medium transition-opacity hover:opacity-70 line-through opacity-50',
                      'bg-gray-100 text-gray-400 border-l-2 border-l-gray-200 dark:bg-gray-800/30 dark:text-gray-500'
                    )}
                    title={[ev.client_name || ev.title, ev.owner_name].filter(Boolean).join(' · ')}
                  >
                    <span className="truncate block">{ev.client_name || ev.title}</span>
                    {(() => {
                      const timeRange = formatEventTimeRange(ev)
                      return timeRange ? (
                        <span className="block text-[9px] opacity-70 leading-tight truncate">{timeRange}</span>
                      ) : null
                    })()}
                  </button>
                ))}
                {/* Manutenções */}
                {dayMaint.slice(0, 1).map((m) => (
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
                {/* Checklists */}
                {dayChklists.slice(0, 1).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onChecklistClick?.(c.url)}
                    className={cn(
                      'w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded-sm truncate font-medium transition-opacity hover:opacity-80 flex items-center gap-0.5',
                      CHECKLIST_PILL
                    )}
                    title={c.title}
                  >
                    <ClipboardList className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">{c.title}</span>
                  </button>
                ))}
                {/* Pré-reservas */}
                {dayPreRes.slice(0, 1).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onPreReservaClick?.(p)}
                    className={cn(
                      'w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded-sm truncate font-medium transition-opacity hover:opacity-80 flex items-center gap-0.5',
                      prPill(p)
                    )}
                    title={p.title}
                  >
                    {prIconSm(p)}
                    <span className="truncate">{p.title}</span>
                  </button>
                ))}
                {/* Overflow counter */}
                {(activeEvents.length > 2 || dayMaint.length > 1 || dayChklists.length > 1 || dayPreRes.length > 1) && (
                  <button
                    onClick={() => onDayClick(day)}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors text-left px-1"
                  >
                    +{Math.max(0, activeEvents.length - 2) + Math.max(0, dayMaint.length - 1) + Math.max(0, dayChklists.length - 1) + Math.max(0, dayPreRes.length - 1)} mais
                  </button>
                )}
              </div>
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
function WeekView({ currentDate, eventsByDate, maintenanceByDate, checklistByDate = {}, preReservaByDate = {}, onEventClick, onMaintenanceClick, onChecklistClick, onPreReservaClick, onDayClick }: ViewProps) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
  const weekEnd   = endOfWeek(currentDate, { weekStartsOn: 1 })
  const days      = eachDayOfInterval({ start: weekStart, end: weekEnd })

  return (
    <div className="overflow-x-auto animate-page-enter">
      <div className="min-w-[480px]">
        {/* Cabeçalho */}
        <div className="grid grid-cols-7 border-b border-border">
          {days.map((day) => {
            const todayFlag = isToday(day)
            return (
              <div key={day.toISOString()} className="py-2 text-center">
                <p className="text-xs text-muted-foreground capitalize">
                  {format(day, 'EEE', { locale: ptBR })}
                </p>
                <button
                  onClick={() => onDayClick(day)}
                  className={cn(
                    'inline-flex items-center justify-center w-7 h-7 mt-0.5 text-sm font-semibold rounded-full transition-colors',
                    todayFlag
                      ? 'bg-primary text-primary-foreground dark:bg-transparent dark:ring-2 dark:ring-primary dark:text-primary'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  {format(day, 'd')}
                </button>
              </div>
            )
          })}
        </div>

        {/* Eventos por dia */}
        <div className="grid grid-cols-7 divide-x divide-border min-h-[200px]">
          {days.map((day) => {
            const key        = format(day, 'yyyy-MM-dd')
            const dayEvents  = eventsByDate[key] ?? []
            const dayMaint   = maintenanceByDate[key] ?? []
            const dayChklists = checklistByDate[key] ?? []
            const dayPreRes  = preReservaByDate[key] ?? []
            const todayFlag  = isToday(day)

            return (
              <div key={key} className={cn('p-1 space-y-0.5', todayFlag && 'bg-[var(--color-brand-50)] dark:bg-[oklch(0.260_0.040_144_/_0.15)]')}>
                {dayEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick(ev)}
                    className={cn(
                      'w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded-sm font-medium transition-opacity hover:opacity-80',
                      ev.status === 'lost' && 'line-through',
                      EVENT_PILL[ev.status]
                    )}
                    title={`${ev.start_time.slice(0, 5)} – ${ev.title}`}
                  >
                    <span className="font-normal opacity-70">{ev.start_time.slice(0, 5)}</span>{' '}
                    <span className="truncate block">{ev.client_name || ev.title}</span>
                  </button>
                ))}
                {dayMaint.map((m) => (
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
                {dayChklists.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onChecklistClick?.(c.url)}
                    className={cn(
                      'w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded-sm font-medium transition-opacity hover:opacity-80 flex items-center gap-0.5',
                      CHECKLIST_PILL
                    )}
                    title={c.title}
                  >
                    <ClipboardList className="w-2.5 h-2.5 shrink-0" />
                    <span className="truncate">{c.title}</span>
                  </button>
                ))}
                {dayPreRes.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => onPreReservaClick?.(p)}
                    className={cn(
                      'w-full text-left text-[10px] leading-tight px-1 py-0.5 rounded-sm font-medium transition-opacity hover:opacity-80 flex items-center gap-0.5',
                      prPill(p)
                    )}
                    title={p.title}
                  >
                    {prIconSm(p)}
                    <span className="truncate">{p.title}</span>
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
function DayView({ currentDate, eventsByDate, maintenanceByDate, checklistByDate = {}, preReservaByDate = {}, onEventClick, onMaintenanceClick, onChecklistClick, onPreReservaClick }: Omit<ViewProps, 'onDayClick'>) {
  const key        = format(currentDate, 'yyyy-MM-dd')
  const dayEvents  = eventsByDate[key] ?? []
  const dayMaint   = maintenanceByDate[key] ?? []
  const dayChklists = checklistByDate[key] ?? []
  const dayPreRes  = preReservaByDate[key] ?? []

  if (dayEvents.length === 0 && dayMaint.length === 0 && dayChklists.length === 0 && dayPreRes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
        <CalendarX className="w-8 h-8 opacity-40" />
        <p className="text-sm">Nenhum evento neste dia.</p>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2 animate-page-enter">
      {dayEvents.map((ev) => (
        <button
          key={ev.id}
          onClick={() => onEventClick(ev)}
          className={cn(
            'w-full text-left rounded-lg px-3 py-2.5 transition-opacity hover:opacity-80 min-h-[44px]',
            ev.status === 'lost' && 'opacity-60',
            EVENT_PILL[ev.status]
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <p className={cn('text-sm font-semibold truncate', ev.status === 'lost' && 'line-through')}>
              {ev.title}
            </p>
            <span className="text-xs opacity-70 shrink-0">
              {ev.start_time.slice(0, 5)} – {ev.end_time.slice(0, 5)}
            </span>
          </div>
          <p className="text-xs opacity-70 mt-0.5">{ev.client_name}</p>
          {ev.owner_name && (
            <p className="text-xs opacity-50 mt-0.5">{ev.owner_name}</p>
          )}
          {ev.status === 'lost' && (
            <span className="inline-block mt-1 text-[10px] opacity-60">{STATUS_LABEL.lost}</span>
          )}
        </button>
      ))}
      {dayMaint.map((m) => (
        <button
          key={m.id}
          onClick={() => onMaintenanceClick?.(m.id)}
          className={cn(
            'w-full text-left rounded-lg px-3 py-2.5 transition-opacity hover:opacity-80 min-h-[44px]',
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
      {dayChklists.map((c) => (
        <button
          key={c.id}
          onClick={() => onChecklistClick?.(c.url)}
          className={cn(
            'w-full text-left rounded-lg px-3 py-2.5 transition-opacity hover:opacity-80 min-h-[44px]',
            CHECKLIST_PILL
          )}
        >
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 shrink-0 opacity-70" />
            <p className="text-sm font-semibold truncate">{c.title}</p>
          </div>
          {c.eventTitle && (
            <p className="text-xs opacity-70 mt-0.5 ml-6">{c.eventTitle}</p>
          )}
        </button>
      ))}
      {dayPreRes.map((p) => (
        <button
          key={p.id}
          onClick={() => onPreReservaClick?.(p)}
          className={cn(
            'w-full text-left rounded-lg px-3 py-2.5 transition-opacity hover:opacity-80 min-h-[44px]',
            prPill(p)
          )}
        >
          <div className="flex items-center gap-2">
            {p.source === 'ploomes'
              ? <Sparkles className="w-4 h-4 shrink-0 opacity-70" />
              : <Shield   className="w-4 h-4 shrink-0 opacity-70" />}
            <p className="text-sm font-semibold truncate">{p.title}</p>
          </div>
          {(p.start_time || p.end_time) && (
            <p className="text-xs opacity-70 mt-0.5 ml-6">
              {p.start_time ?? '—'}{p.end_time ? ` → ${p.end_time}` : ''}
            </p>
          )}
        </button>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// VISAO LISTA (mobile)
// ─────────────────────────────────────────────────────────────
function ListView({
  events,
  maintenanceItems = [],
  checklistItems = [],
  preReservaItems = [],
  onEventClick,
  onMaintenanceClick,
  onChecklistClick,
  onPreReservaClick,
}: {
  events: CalendarEvent[]
  maintenanceItems: CalendarMaintenance[]
  checklistItems?: CalendarChecklist[]
  preReservaItems?: CalendarPreReserva[]
  onEventClick: (e: CalendarEvent) => void
  onMaintenanceClick?: (id: string) => void
  onChecklistClick?: (url: string) => void
  onPreReservaClick?: (item: CalendarPreReserva) => void
}) {
  type ListItem =
    | { kind: 'event';       date: string; data: CalendarEvent }
    | { kind: 'maintenance'; date: string; data: CalendarMaintenance }
    | { kind: 'checklist';   date: string; data: CalendarChecklist }
    | { kind: 'pre-reserva'; date: string; data: CalendarPreReserva }

  const sorted = useMemo((): ListItem[] => {
    const items: ListItem[] = [
      ...events.map((e): ListItem => ({ kind: 'event', date: e.date, data: e })),
      ...maintenanceItems.filter((m) => !!m.date).map((m): ListItem => ({ kind: 'maintenance', date: m.date!, data: m })),
      ...checklistItems.map((c): ListItem => ({ kind: 'checklist', date: c.date, data: c })),
      ...preReservaItems.map((p): ListItem => ({ kind: 'pre-reserva', date: p.date, data: p })),
    ]
    return items.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      if (a.kind === 'event' && b.kind === 'event') {
        return (a.data.start_time ?? '').localeCompare(b.data.start_time ?? '')
      }
      return 0
    })
  }, [events, maintenanceItems, checklistItems, preReservaItems])

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
        <CalendarX className="w-8 h-8 opacity-40" />
        <p className="text-sm">Nenhum evento neste período.</p>
      </div>
    )
  }

  // Agrupa por data
  const groups: { date: string; items: ListItem[] }[] = []
  for (const item of sorted) {
    const last = groups[groups.length - 1]
    if (last && last.date === item.date) {
      last.items.push(item)
    } else {
      groups.push({ date: item.date, items: [item] })
    }
  }

  return (
    <div className="divide-y divide-border">
      {groups.map(({ date, items }) => {
        const dayDate    = new Date(date + 'T00:00:00')
        const todayFlag  = format(new Date(), 'yyyy-MM-dd') === date

        return (
          <div key={date} className={cn('px-3 py-2', todayFlag && 'bg-[var(--color-brand-50)] dark:bg-[oklch(0.260_0.040_144_/_0.15)]')}>
            {/* Data header */}
            <div className="flex items-center gap-2 mb-1.5">
              <span className={cn(
                'text-xs font-semibold capitalize',
                todayFlag ? 'text-primary' : 'text-muted-foreground'
              )}>
                {todayFlag
                  ? 'Hoje'
                  : format(dayDate, "EEE, d 'de' MMM", { locale: ptBR })}
              </span>
              {todayFlag && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                  Hoje
                </span>
              )}
            </div>

            {/* Items do dia */}
            <div className="space-y-1">
              {items.map((item) => {
                if (item.kind === 'event') {
                  const ev = item.data
                  return (
                    <button
                      key={ev.id}
                      onClick={() => onEventClick(ev)}
                      className={cn(
                        'w-full text-left rounded-lg px-2.5 py-2 min-h-[44px] transition-opacity hover:opacity-80',
                        ev.status === 'lost' && 'opacity-60',
                        EVENT_PILL[ev.status]
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-xs font-semibold truncate', ev.status === 'lost' && 'line-through')}>
                          {ev.client_name || ev.title}
                        </p>
                        {ev.start_time && (
                          <span className="text-[10px] opacity-70 shrink-0 mt-0.5">
                            {ev.start_time.slice(0, 5)}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                } else if (item.kind === 'maintenance') {
                  const m = item.data
                  return (
                    <button
                      key={m.id}
                      onClick={() => onMaintenanceClick?.(m.id)}
                      className={cn(
                        'w-full text-left rounded-lg px-2.5 py-2 min-h-[44px] transition-opacity hover:opacity-80 flex items-center gap-2',
                        MAINTENANCE_PILL[m.type]
                      )}
                    >
                      <Wrench className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      <p className="text-xs font-semibold truncate">{m.title}</p>
                      {m.sector && (
                        <span className="ml-auto text-[10px] opacity-60 shrink-0">{m.sector.name}</span>
                      )}
                    </button>
                  )
                } else if (item.kind === 'checklist') {
                  const c = item.data
                  return (
                    <button
                      key={c.id}
                      onClick={() => onChecklistClick?.(c.url)}
                      className={cn(
                        'w-full text-left rounded-lg px-2.5 py-2 min-h-[44px] transition-opacity hover:opacity-80 flex items-center gap-2',
                        CHECKLIST_PILL
                      )}
                    >
                      <ClipboardList className="w-3.5 h-3.5 shrink-0 opacity-70" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{c.title}</p>
                        {c.eventTitle && (
                          <p className="text-[10px] opacity-60 truncate">{c.eventTitle}</p>
                        )}
                      </div>
                    </button>
                  )
                } else if (item.kind === 'pre-reserva') {
                  const p = item.data
                  return (
                    <button
                      key={p.id}
                      onClick={() => onPreReservaClick?.(p)}
                      className={cn(
                        'w-full text-left rounded-lg px-2.5 py-2 min-h-[44px] transition-opacity hover:opacity-80 flex items-center gap-2',
                        prPill(p)
                      )}
                    >
                      {p.source === 'ploomes'
                        ? <Sparkles className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        : <Shield   className="w-3.5 h-3.5 shrink-0 opacity-70" />}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">{p.title}</p>
                        {(p.start_time || p.end_time) && (
                          <p className="text-[10px] opacity-60 truncate">
                            {p.start_time ?? '—'}{p.end_time ? ` → ${p.end_time}` : ''}
                          </p>
                        )}
                      </div>
                      <span className={cn(
                        'shrink-0 text-[9px] font-medium px-1.5 py-0.5 rounded-full',
                        p.source === 'ploomes'
                          ? 'bg-pink-500/10 text-pink-700 dark:text-pink-400'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
                      )}>
                        {p.source === 'ploomes' ? 'Ploomes' : 'Pré-venda'}
                      </span>
                    </button>
                  )
                }
                return null
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
