'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import { Calendar, CheckCircle2, Clock4, Zap, Wrench, AlertTriangle, WifiOff } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { StatsCard } from '@/components/features/dashboard/stats-card'
import { NextEventCard } from '@/components/features/dashboard/next-event-card'
import { CalendarView, type CalendarViewType } from '@/components/features/dashboard/calendar-view'
import { EventQuickView } from '@/components/features/dashboard/event-quick-view'
import {
  useDashboardStats,
  useDashboardMaintenanceStats,
  useNextEvent,
  useCalendarEvents,
  useCalendarMaintenance,
  type CalendarEvent,
} from '@/hooks/use-dashboard'

export default function DashboardPage() {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [calView, setCalView] = useState<CalendarViewType>('month')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showMaintenance, setShowMaintenance] = useState(true)

  // Calcula o range de datas para a query do calendário
  const { dateFrom, dateTo } = useMemo(() => {
    if (calView === 'month') {
      return {
        dateFrom: format(startOfMonth(currentDate), 'yyyy-MM-dd'),
        dateTo:   format(endOfMonth(currentDate),   'yyyy-MM-dd'),
      }
    }
    if (calView === 'week') {
      return {
        dateFrom: format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        dateTo:   format(endOfWeek(currentDate,   { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      }
    }
    // day
    const d = format(currentDate, 'yyyy-MM-dd')
    return { dateFrom: d, dateTo: d }
  }, [currentDate, calView])

  const { data: stats, isLoading: loadingStats } = useDashboardStats()
  const { data: maintenanceStats, isLoading: loadingMaintenanceStats } = useDashboardMaintenanceStats()
  const { data: nextEvent, isLoading: loadingNext } = useNextEvent()
  const {
    data: calEvents = [],
    isLoading: loadingCal,
    isOffline: calIsOffline,
    cachedAt: calCachedAt,
  } = useCalendarEvents(dateFrom, dateTo)
  const { data: calMaintenance = [] } = useCalendarMaintenance(dateFrom, dateTo, showMaintenance)

  // Saudação baseada no horário — computada apenas no cliente para evitar
  // mismatch de hidratação (servidor pode estar em fuso diferente do browser)
  const [greeting, setGreeting] = useState('Olá')
  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite')
  }, [])

  return (
    <div className="space-y-6">
      <PageHeader
        title={greeting}
        description="Visão geral das operações do Cachola"
      />

      {/* ── Stats de eventos ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard
          title="Este Mês"
          value={stats?.thisMonth}
          icon={Calendar}
          description="eventos no mês atual"
          iconClass="bg-primary/10 text-primary"
          isLoading={loadingStats}
        />
        <StatsCard
          title="Confirmados"
          value={stats?.confirmed}
          icon={CheckCircle2}
          description="aguardando realização"
          iconClass="bg-blue-50 text-blue-600"
          isLoading={loadingStats}
        />
        <StatsCard
          title="Pendentes"
          value={stats?.pending}
          icon={Clock4}
          description="aguardando confirmação"
          iconClass="bg-amber-50 text-amber-600"
          isLoading={loadingStats}
        />
        <StatsCard
          title="Em Andamento"
          value={stats?.active}
          icon={Zap}
          description="em preparo ou execução"
          iconClass="bg-green-50 text-green-600"
          isLoading={loadingStats}
        />
      </div>

      {/* ── Stats de manutenção ── */}
      <div className="grid grid-cols-2 gap-3">
        <StatsCard
          title="Manutenções Abertas"
          value={maintenanceStats?.open}
          icon={Wrench}
          description="ordens em aberto"
          iconClass="bg-orange-50 text-orange-600"
          isLoading={loadingMaintenanceStats}
          onClick={() => router.push('/manutencao')}
        />
        <StatsCard
          title="Urgentes Hoje"
          value={maintenanceStats?.urgentToday}
          icon={AlertTriangle}
          description="emergenciais ou atrasadas"
          iconClass="bg-red-50 text-red-600"
          isLoading={loadingMaintenanceStats}
          onClick={() => router.push('/manutencao')}
        />
      </div>

      {/* ── Banner offline (calendário) ── */}
      {calIsOffline && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm text-amber-800">
          <WifiOff className="size-4 shrink-0" />
          <span>
            Dados offline — calendário em cache
            {calCachedAt && (
              <> · última atualização: {new Date(calCachedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</>
            )}
          </span>
        </div>
      )}

      {/* ── Próximo evento + Calendário ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-4 items-start">
        <NextEventCard event={nextEvent} isLoading={loadingNext} />

        <CalendarView
          events={calEvents}
          maintenanceItems={calMaintenance}
          showMaintenance={showMaintenance}
          onToggleMaintenance={() => setShowMaintenance((v) => !v)}
          currentDate={currentDate}
          view={calView}
          onDateChange={setCurrentDate}
          onViewChange={setCalView}
          onEventClick={setSelectedEvent}
          onMaintenanceClick={(id) => router.push(`/manutencao/${id}`)}
          isLoading={loadingCal}
        />
      </div>

      {/* ── Quick view drawer ── */}
      <EventQuickView
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  )
}
