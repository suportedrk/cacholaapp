'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import {
  Calendar, TrendingUp, UserPlus, AlertTriangle, ClipboardList, WifiOff,
} from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/features/dashboard/kpi-card'
import { CalendarView, type CalendarViewType } from '@/components/features/dashboard/calendar-view'
import { EventQuickView } from '@/components/features/dashboard/event-quick-view'
import { SetupChecklistCard } from '@/components/features/onboarding/setup-checklist-card'
import {
  useDashboardKpis,
  useCalendarEvents,
  useCalendarMaintenance,
  type CalendarEvent,
} from '@/hooks/use-dashboard'
import { useCalendarChecklists } from '@/hooks/use-calendar-checklists'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { BRAND_GREEN } from '@/lib/constants/brand-colors'

// ── Stroke colors for sparklines (Recharts requires hex, not CSS vars) ──
const STROKE = {
  brand:  BRAND_GREEN[500],  // '#7C8D78'
  green:  '#16A34A',
  amber:  '#D97706',
  red:    '#DC2626',
  orange: '#EA580C',
} as const

export default function DashboardPage() {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [calView, setCalView]         = useState<CalendarViewType>('month')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showMaintenance, setShowMaintenance] = useState(true)

  // Calendar date range
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
    const d = format(currentDate, 'yyyy-MM-dd')
    return { dateFrom: d, dateTo: d }
  }, [currentDate, calView])

  const { data: kpis, isLoading: loadingKpis } = useDashboardKpis()
  const {
    data: calEvents = [],
    isLoading: loadingCal,
    isOffline: calIsOffline,
    cachedAt: calCachedAt,
  } = useCalendarEvents(dateFrom, dateTo)
  const { data: calMaintenance = [] } = useCalendarMaintenance(dateFrom, dateTo, showMaintenance)
  const { data: calChecklists = [] } = useCalendarChecklists()

  const { isTimedOut, retry } = useLoadingTimeout(loadingKpis || loadingCal)

  // Greeting (client-only to avoid hydration mismatch)
  const [greeting, setGreeting] = useState('Olá')
  useEffect(() => {
    const h = new Date().getHours()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGreeting(h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite')
  }, [])

  // Dynamic maintenance color: red if > 5 open orders
  const mnValue = kpis?.maintenance.value ?? 0
  const mnStroke    = mnValue > 5 ? STROKE.red   : STROKE.orange
  const mnIconClass = mnValue > 5 ? 'icon-red'   : 'icon-orange'

  if (isTimedOut) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-text-secondary text-sm">O carregamento está demorando mais que o esperado.</p>
        <button onClick={retry} className="text-sm text-primary underline underline-offset-4">
          Tentar novamente
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={greeting}
        description="Visão geral das operações do Cachola"
      />

      {/* ── Setup checklist (admins) ── */}
      <SetupChecklistCard />

      {/* ── KPI Grid — 5 cards: 2 colunas mobile, 3 tablet, 5 desktop ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          label="Eventos do Mês"
          value={kpis?.events.value ?? 0}
          icon={Calendar}
          iconClass="icon-brand"
          strokeColor={STROKE.brand}
          spark={kpis?.events.spark ?? []}
          trend={kpis?.events.trend}
          href="/eventos"
          isLoading={loadingKpis}
          className="animate-fade-up [animation-delay:0ms]"
        />
        <KpiCard
          label="Taxa de Conversão"
          value={`${kpis?.conversion.value ?? 0}%`}
          icon={TrendingUp}
          iconClass="icon-green"
          strokeColor={STROKE.green}
          spark={kpis?.conversion.spark ?? []}
          trend={kpis?.conversion.trend}
          href="/eventos"
          isLoading={loadingKpis}
          className="animate-fade-up [animation-delay:50ms]"
        />
        <KpiCard
          label="Leads do Mês"
          value={kpis?.leads.value ?? 0}
          icon={UserPlus}
          iconClass="icon-amber"
          strokeColor={STROKE.amber}
          spark={kpis?.leads.spark ?? []}
          trend={kpis?.leads.trend}
          href="/eventos"
          isLoading={loadingKpis}
          className="animate-fade-up [animation-delay:100ms]"
        />
        <KpiCard
          label="Manutenções Abertas"
          value={kpis?.maintenance.value ?? 0}
          icon={AlertTriangle}
          iconClass={mnIconClass}
          strokeColor={mnStroke}
          spark={kpis?.maintenance.spark ?? []}
          trend={kpis?.maintenance.trend}
          invertTrend
          href="/manutencao"
          isLoading={loadingKpis}
          className="animate-fade-up [animation-delay:150ms]"
        />
        {/* 5º card: col-span-2 no mobile para preencher a linha; normal no md/lg */}
        <KpiCard
          label="Checklists Pendentes"
          value={kpis?.checklists.value ?? 0}
          icon={ClipboardList}
          iconClass="icon-amber"
          strokeColor={STROKE.amber}
          spark={kpis?.checklists.spark ?? []}
          trend={kpis?.checklists.trend}
          invertTrend
          href="/checklists"
          isLoading={loadingKpis}
          className="animate-fade-up [animation-delay:200ms] col-span-2 md:col-span-1"
        />
      </div>

      {/* ── Offline banner (calendário) ── */}
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

      {/* ── Calendário — largura total ── */}
      <div data-tour="calendar">
        <CalendarView
          events={calEvents}
          maintenanceItems={calMaintenance}
          checklistItems={calChecklists}
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
