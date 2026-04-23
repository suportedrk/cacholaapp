'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns'
import {
  Calendar, UserPlus, ClipboardList, WifiOff,
  // TrendingUp, AlertTriangle — Movidos para módulo BI (Fase 3)
} from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from '@/components/ui/select'
import { PageHeader } from '@/components/shared/page-header'
import { KpiCard } from '@/components/features/dashboard/kpi-card'
import { CalendarView, type CalendarViewType } from '@/components/features/dashboard/calendar-view'
import { EventQuickView } from '@/components/features/dashboard/event-quick-view'
import { PreReservaDetailModal } from '@/components/features/dashboard/pre-reserva-detail-modal'
import { PreReservaModal } from '@/components/features/dashboard/pre-reserva-modal'
import { SelectUnitModal } from '@/components/shared/select-unit-modal'
import { SetupChecklistCard } from '@/components/features/onboarding/setup-checklist-card'
import {
  useDashboardKpis,
  useCalendarEvents,
  useCalendarMaintenance,
  type CalendarEvent,
} from '@/hooks/use-dashboard'
import { useCalendarChecklists } from '@/hooks/use-calendar-checklists'
import { useCalendarPreReservas } from '@/hooks/use-calendar-pre-reservas'
import { usePreReservasPloomes } from '@/hooks/use-pre-reservas-ploomes'
import { useLoadingTimeout } from '@/hooks/use-loading-timeout'
import { useAuth } from '@/hooks/use-auth'
import { useUnitStore } from '@/stores/unit-store'
import { BRAND_GREEN } from '@/lib/constants/brand-colors'
import type { CalendarPreReserva } from '@/types/pre-reservas'

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
  const { profile, activeUnitId } = useAuth()
  const { activeUnit, userUnits } = useUnitStore()

  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [calView, setCalView]         = useState<CalendarViewType>('month')
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [showMaintenance, setShowMaintenance] = useState(true)

  // Pré-reservas — estado de modais
  const [selectedPreReserva, setSelectedPreReserva] = useState<CalendarPreReserva | null>(null)
  const [showPreReservaModal, setShowPreReservaModal]   = useState(false)
  const [showSelectUnit, setShowSelectUnit]             = useState(false)
  const [pendingPreReservaUnitId, setPendingPreReservaUnitId] = useState<string | null>(null)

  const canManagePreReservas =
    profile?.role === 'super_admin' || profile?.role === 'diretor'

  // Filtro por vendedora
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null)
  const handleOwnerChange = useCallback((v: string | null) => {
    setSelectedOwner(!v || v === '__all__' ? null : v)
  }, [])

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

  // Período para exportação do calendário
  const exportPeriod = useMemo(() => ({
    viewType: calView,
    startDate: new Date(dateFrom),
    endDate: new Date(dateTo),
    referenceDate: currentDate,
  }), [calView, dateFrom, dateTo, currentDate])

  const { data: kpis, isLoading: loadingKpis } = useDashboardKpis()
  const {
    data: calEvents = [],
    isLoading: loadingCal,
    isOffline: calIsOffline,
    cachedAt: calCachedAt,
  } = useCalendarEvents(dateFrom, dateTo)
  const { data: calMaintenance = [] } = useCalendarMaintenance(dateFrom, dateTo, showMaintenance)
  const { data: calChecklists = [] } = useCalendarChecklists()
  const { data: calPreReservasDiretoria = [] } = useCalendarPreReservas(dateFrom, dateTo)
  const { data: calPreReservasPloomes   = [] } = usePreReservasPloomes(dateFrom, dateTo)
  const calPreReservas = useMemo(
    () => [...calPreReservasDiretoria, ...calPreReservasPloomes],
    [calPreReservasDiretoria, calPreReservasPloomes],
  )

  // Vendedoras únicas dos eventos + pré-reservas carregados
  const ownerOptions = useMemo(() => {
    const names = new Set<string>()
    calEvents.forEach((e) => { if (e.owner_name) names.add(e.owner_name) })
    calPreReservas.forEach((pr) => { if (pr.owner_name) names.add(pr.owner_name) })
    return Array.from(names).sort()
  }, [calEvents, calPreReservas])

  // Eventos + pré-reservas filtrados por vendedora
  const filteredCalEvents = useMemo(
    () => selectedOwner ? calEvents.filter((e) => e.owner_name === selectedOwner) : calEvents,
    [calEvents, selectedOwner],
  )
  const filteredCalPreReservas = useMemo(
    () => selectedOwner ? calPreReservas.filter((pr) => pr.owner_name === selectedOwner) : calPreReservas,
    [calPreReservas, selectedOwner],
  )

  const { isTimedOut, retry } = useLoadingTimeout(loadingKpis || loadingCal)

  // Greeting (client-only to avoid hydration mismatch)
  const [greeting, setGreeting] = useState('Olá')
  useEffect(() => {
    const h = new Date().getHours()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGreeting(h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite')
  }, [])

  // Handler: abrir modal de nova pré-reserva com guard de unidade
  function handleNewPreReserva() {
    if (!activeUnitId) {
      setShowSelectUnit(true)
    } else {
      setPendingPreReservaUnitId(activeUnitId)
      setShowPreReservaModal(true)
    }
  }

  // TODO: Mover para módulo BI — manutenção e conversão ficam lá
  // const mnValue = kpis?.maintenance.value ?? 0
  // const mnStroke    = mnValue > 5 ? STROKE.red   : STROKE.orange
  // const mnIconClass = mnValue > 5 ? 'icon-red'   : 'icon-orange'

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

      {/* ── KPI Grid — 3 cards operacionais: 1 coluna mobile, 3 tablet/desktop ── */}
      {/* KPIs estratégicos (Taxa de Conversão, Manutenções Abertas) movidos para módulo BI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
        {/* Taxa de Conversão — Movido para módulo BI (Fase 3)
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
        /> */}
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
        {/* Manutenções Abertas — Movido para módulo BI (Fase 3)
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
        /> */}
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
          className="animate-fade-up [animation-delay:200ms]"
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
        {/* Filtro de vendedora */}
        {ownerOptions.length > 0 && (
          <div className="flex justify-end mb-3">
            <Select value={selectedOwner ?? '__all__'} onValueChange={handleOwnerChange}>
              <SelectTrigger className="w-40 text-sm">
                <span data-slot="select-value" className="flex flex-1 text-left truncate">
                  {selectedOwner ?? 'Vendedora'}
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                {ownerOptions.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <CalendarView
          events={filteredCalEvents}
          maintenanceItems={calMaintenance}
          checklistItems={calChecklists}
          preReservaItems={filteredCalPreReservas}
          showMaintenance={showMaintenance}
          onToggleMaintenance={() => setShowMaintenance((v) => !v)}
          currentDate={currentDate}
          view={calView}
          onDateChange={setCurrentDate}
          onViewChange={setCalView}
          onEventClick={setSelectedEvent}
          onMaintenanceClick={(id) => router.push(`/manutencao/${id}`)}
          onPreReservaClick={(item) => {
            if (item.source === 'ploomes' && item.ploomes_url) {
              window.open(item.ploomes_url, '_blank', 'noopener,noreferrer')
            } else {
              setSelectedPreReserva(item)
            }
          }}
          onNewPreReserva={canManagePreReservas ? handleNewPreReserva : undefined}
          canManagePreReservas={canManagePreReservas}
          isLoading={loadingCal}
          activeUnitName={
            activeUnit?.name ??
            userUnits.find((uu) => uu.unit_id === activeUnitId)?.unit.name ??
            undefined
          }
          exportPeriod={exportPeriod}
        />
      </div>

      {/* ── Quick view drawer — Evento ── */}
      <EventQuickView
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />

      {/* ── Quick view drawer — Pré-reserva ── */}
      <PreReservaDetailModal
        item={selectedPreReserva}
        onClose={() => setSelectedPreReserva(null)}
        canManage={canManagePreReservas}
      />

      {/* ── Modal criar pré-reserva ── */}
      {pendingPreReservaUnitId && (
        <PreReservaModal
          open={showPreReservaModal}
          onClose={() => { setShowPreReservaModal(false); setPendingPreReservaUnitId(null) }}
          unitId={pendingPreReservaUnitId}
        />
      )}

      {/* ── Guard de unidade para pré-reserva ── */}
      <SelectUnitModal
        open={showSelectUnit}
        onClose={() => setShowSelectUnit(false)}
        onConfirm={(unitId) => {
          setShowSelectUnit(false)
          setPendingPreReservaUnitId(unitId)
          setShowPreReservaModal(true)
        }}
      />
    </div>
  )
}
