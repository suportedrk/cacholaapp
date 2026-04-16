'use client'

import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns'
import type { EventStatus, MaintenanceType } from '@/types/database.types'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import { useOnlineStatus } from './use-online-status'
import { getOfflineDb } from '@/lib/offline-db'

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export type DashboardStats = {
  thisMonth: number
  confirmed: number
  pending: number
  active: number // preparing + in_progress
}

export type CalendarEvent = {
  id: string
  title: string
  date: string          // 'YYYY-MM-DD'
  start_time: string    // 'HH:MM:SS'
  end_time: string      // 'HH:MM:SS'
  status: EventStatus
  client_name: string
  birthday_person: string | null
  owner_name: string | null
  // event_types e venues foram dropadas na migration 030
  entityType?: 'event'  // default
}

export type CalendarMaintenance = {
  id: string
  title: string
  date: string          // due_date 'YYYY-MM-DD'
  type: MaintenanceType
  status: string
  sector: { id: string; name: string } | null
  entityType: 'maintenance'
}

export type DashboardMaintenanceStats = {
  open: number
  urgentToday: number   // emergenciais abertas ou atrasadas
}


// event_types e venues foram dropadas na migration 030
const CALENDAR_EVENT_SELECT = `
  id, title, date, start_time, end_time, status, client_name, birthday_person, owner_name
` as const

// ─────────────────────────────────────────────────────────────
// STATS DO MÊS ATUAL
// ─────────────────────────────────────────────────────────────
export function useDashboardStats() {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['dashboard', 'stats', activeUnitId],
    enabled: isSessionReady,
    queryFn: async () => {
      const supabase = createClient()
      const now = new Date()
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
      const monthEnd   = format(endOfMonth(now),   'yyyy-MM-dd')

      let q = supabase
        .from('events')
        .select('status, date')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .neq('status', 'lost')   // 'lost' excluído dos contadores do dashboard
      if (activeUnitId) q = q.eq('unit_id', activeUnitId)
      const { data, error } = await q

      if (error) throw error

      return {
        thisMonth: data.length,
        confirmed: data.filter((e) => e.status === 'confirmed').length,
        pending:   data.filter((e) => e.status === 'pending').length,
        active:    data.filter((e) => e.status === 'preparing' || e.status === 'in_progress').length,
      } satisfies DashboardStats
    },
    staleTime: 60 * 1000,
  })
}


// ─────────────────────────────────────────────────────────────
// STATS DE MANUTENÇÃO
// ─────────────────────────────────────────────────────────────
export function useDashboardMaintenanceStats() {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['dashboard', 'maintenance-stats', activeUnitId],
    enabled: isSessionReady,
    queryFn: async () => {
      const supabase = createClient()
      const today = format(new Date(), 'yyyy-MM-dd')

      let q = supabase
        .from('maintenance_tickets')
        .select('nature, status, due_at')
        .not('status', 'in', '("concluded","cancelled")')
      if (activeUnitId) q = q.eq('unit_id', activeUnitId)
      const { data, error } = await q

      if (error) throw error

      const orders = data ?? []
      const open = orders.length
      const urgentToday = orders.filter((o) =>
        o.nature === 'emergencial' ||
        (o.due_at && o.due_at.split('T')[0] <= today)
      ).length

      return { open, urgentToday } satisfies DashboardMaintenanceStats
    },
    staleTime: 60 * 1000,
  })
}

// ─────────────────────────────────────────────────────────────
// EVENTOS DO CALENDÁRIO (range de datas)
// ─────────────────────────────────────────────────────────────
export function useCalendarEvents(dateFrom: string, dateTo: string) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { isOnline } = useOnlineStatus()
  const [offlineData, setOfflineData] = useState<CalendarEvent[]>([])
  const [cachedAt, setCachedAt]       = useState<string | null>(null)
  const [isLoadingOffline, setIsLoadingOffline] = useState(false)

  const cacheKey = `${dateFrom}::${dateTo}::${activeUnitId ?? 'all'}`

  const query = useQuery({
    queryKey: ['dashboard', 'calendar', dateFrom, dateTo, activeUnitId],
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('events')
        .select(CALENDAR_EVENT_SELECT)
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .neq('status', 'lost')   // 'lost' não aparece no calendário
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
      if (activeUnitId) q = q.eq('unit_id', activeUnitId)
      const { data, error } = await q

      if (error) throw error
      return (data ?? []) as unknown as CalendarEvent[]
    },
    staleTime: 30 * 1000,
    enabled: isSessionReady && isOnline && !!dateFrom && !!dateTo,
  })

  // Salvar no IDB sempre que dados online chegarem
  useEffect(() => {
    if (!isOnline || !query.data) return
    getOfflineDb().then((db) =>
      db.put('calendar_events', {
        key: cacheKey,
        data: query.data,
        cachedAt: new Date().toISOString(),
      })
    ).catch(() => {})
  }, [isOnline, query.data, cacheKey])

  // Carregar do IDB quando offline
  useEffect(() => {
    if (isOnline || !dateFrom || !dateTo) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoadingOffline(true)
    getOfflineDb().then(async (db) => {
      const cached = await db.get('calendar_events', cacheKey)
      setOfflineData(cached ? (cached.data as CalendarEvent[]) : [])
      setCachedAt(cached?.cachedAt ?? null)
    }).catch(() => {
      setOfflineData([])
    }).finally(() => setIsLoadingOffline(false))
  }, [isOnline, cacheKey, dateFrom, dateTo])

  return {
    data:      isOnline ? (query.data ?? []) : offlineData,
    isLoading: isOnline ? query.isLoading    : isLoadingOffline,
    isError:   isOnline ? query.isError      : false,
    isOffline: !isOnline,
    cachedAt,
  }
}

// ─────────────────────────────────────────────────────────────
// MANUTENÇÕES DO CALENDÁRIO (por due_date)
// ─────────────────────────────────────────────────────────────

/** Maps new Portuguese nature values (maintenance_tickets.nature) to legacy MaintenanceType */
const NATURE_TO_TYPE: Record<string, MaintenanceType> = {
  emergencial: 'emergency',
  pontual:     'punctual',
  agendado:    'recurring',
  preventivo:  'preventive',
}

export function useCalendarMaintenance(dateFrom: string, dateTo: string, enabled: boolean) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['dashboard', 'calendar-maintenance', dateFrom, dateTo, activeUnitId],
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('maintenance_tickets')
        .select('id, title, nature, status, due_at, sector:maintenance_sectors(id, name)')
        .gte('due_at', `${dateFrom}T00:00:00`)
        .lte('due_at', `${dateTo}T23:59:59`)
        .not('status', 'in', '("concluded","cancelled")')
        .order('due_at', { ascending: true })
      if (activeUnitId) q = q.eq('unit_id', activeUnitId)
      const { data, error } = await q

      if (error) throw error
      return (data ?? []).map((o) => ({
        id: o.id,
        title: o.title,
        date: o.due_at ? o.due_at.split('T')[0] : '',
        type: (NATURE_TO_TYPE[o.nature] ?? 'punctual') as MaintenanceType,
        status: o.status,
        sector: o.sector as unknown as { id: string; name: string } | null,
        entityType: 'maintenance' as const,
      })) satisfies CalendarMaintenance[]
    },
    staleTime: 30 * 1000,
    enabled: isSessionReady && enabled && !!dateFrom && !!dateTo,
  })
}

// ─────────────────────────────────────────────────────────────
// KPI TRENDS — sparklines + comparação mensal
// ─────────────────────────────────────────────────────────────

export type SparkPoint = { v: number }

export type KpiMetric = {
  value: number
  trend: number | null   // % change vs prior month; null when no prior data
  spark: SparkPoint[]    // 6 data points oldest → newest
}

export type DashboardKpis = {
  events:      KpiMetric  // confirmed events by event date this month
  conversion:  KpiMetric  // confirmed / (confirmed + lost) by created_at month
  leads:       KpiMetric  // all events created this month (any status)
  maintenance: KpiMetric  // currently open orders (trend vs 30 days ago)
  checklists:  KpiMetric  // currently pending (trend vs 30 days ago)
}

/** Returns array of 'yyyy-MM' strings for the last `count` months (oldest first) */
function buildMonths(now: Date, count = 6): string[] {
  return Array.from({ length: count }, (_, i) =>
    format(startOfMonth(subMonths(now, count - 1 - i)), 'yyyy-MM'),
  )
}

function trendPct(curr: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((curr - prev) / prev) * 100)
}

export function useDashboardKpis() {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['dashboard', 'kpis', activeUnitId],
    enabled: isSessionReady,
    staleTime: 2 * 60 * 1000,
    retry: (count, err: { status?: number } | null) =>
      count < 3 && err?.status !== 401 && err?.status !== 403,
    queryFn: async (): Promise<DashboardKpis> => {
      const supabase   = createClient()
      const now        = new Date()
      const rangeStart = startOfMonth(subMonths(now, 5))
      const months     = buildMonths(now, 6)
      const curMo      = months[5]   // 'yyyy-MM' mês atual
      const prevMo     = months[4]   // mês anterior
      const thirtyDaysAgo = subDays(now, 30)

      // ── Query 1: todos os eventos por data da festa (incluindo lost)
      // Usado para: Eventos do Mês, Leads do Mês e Taxa de Conversão.
      // NÃO usar created_at — todos os eventos foram sincronizados do Ploomes em batch
      // (created_at = data do sync, não data de criação do deal).
      const evQ = (() => {
        let q = supabase
          .from('events')
          .select('date, status')
          .gte('date', format(rangeStart, 'yyyy-MM-dd'))
        if (activeUnitId) q = q.eq('unit_id', activeUnitId)
        return q
      })()

      // ── Query 2: todos os chamados de manutenção (sem filtro de data)
      // Inclui concluded_at para calcular "estava aberto há 30 dias"
      const mnQ = (() => {
        let q = supabase
          .from('maintenance_tickets')
          .select('created_at, status, concluded_at')
        if (activeUnitId) q = q.eq('unit_id', activeUnitId)
        return q
      })()

      // ── Query 3: todos os checklists (sem filtro de data)
      // Inclui completed_at para calcular "estava pendente há 30 dias"
      const clQ = (() => {
        let q = supabase
          .from('checklists')
          .select('created_at, status, completed_at')
        if (activeUnitId) q = q.eq('unit_id', activeUnitId)
        return q
      })()

      const [evRes, mnRes, clRes] = await Promise.all([evQ, mnQ, clQ])

      const evAll    = evRes.data  ?? []
      const mnOrders = mnRes.data  ?? []
      const clItems  = clRes.data  ?? []

      // ── Buckets por mês (data da festa) ─────────────────────
      type EvBucket = { confirmed: number; lost: number }
      const evByMo: Record<string, EvBucket> = {}
      months.forEach((m) => { evByMo[m] = { confirmed: 0, lost: 0 } })
      evAll.forEach((e) => {
        const m = e.date.substring(0, 7)
        if (!evByMo[m]) return
        if (e.status === 'confirmed') evByMo[m].confirmed++
        else if (e.status === 'lost') evByMo[m].lost++
      })

      // ── Eventos do Mês — só confirmados ──────────────────────
      const eventsKpi: KpiMetric = {
        value: evByMo[curMo]?.confirmed ?? 0,
        trend: trendPct(evByMo[curMo]?.confirmed ?? 0, evByMo[prevMo]?.confirmed ?? 0),
        spark: months.map((m) => ({ v: evByMo[m]?.confirmed ?? 0 })),
      }

      // ── Leads do Mês — confirmados + perdidos ────────────────
      const totalForMo = (m: string) =>
        (evByMo[m]?.confirmed ?? 0) + (evByMo[m]?.lost ?? 0)
      const leadsKpi: KpiMetric = {
        value: totalForMo(curMo),
        trend: trendPct(totalForMo(curMo), totalForMo(prevMo)),
        spark: months.map((m) => ({ v: totalForMo(m) })),
      }

      // ── Taxa de Conversão — confirmed / (confirmed + lost) ───
      const toCvt = (m: string): number => {
        const total = totalForMo(m)
        return total > 0 ? Math.round(((evByMo[m]?.confirmed ?? 0) / total) * 100) : 0
      }
      const conversionKpi: KpiMetric = {
        value: toCvt(curMo),
        trend: totalForMo(curMo) > 0 ? trendPct(toCvt(curMo), toCvt(prevMo)) : null,
        spark: months.map((m) => ({ v: toCvt(m) })),
      }

      // ── Manutenções Abertas — trend vs 30 dias atrás ─────────
      const mnOpenNow = mnOrders.filter(
        (o) => o.status !== 'concluded' && o.status !== 'cancelled',
      ).length

      // Estava aberto há 30 dias = criado antes do corte E não concluído antes do corte
      const mnOpen30 = mnOrders.filter((o) => {
        if (o.status === 'cancelled') return false
        if (new Date(o.created_at) > thirtyDaysAgo) return false
        if (o.concluded_at) return new Date(o.concluded_at) > thirtyDaysAgo
        // status=concluded sem concluded_at: assume concluído antes do corte
        if (o.status === 'concluded') return false
        return true
      }).length

      // Sparkline: novas ordens abertas por mês (proxy de atividade)
      const mnByMo: Record<string, number> = {}
      months.forEach((m) => { mnByMo[m] = 0 })
      mnOrders.forEach((o) => {
        const m = (o.created_at ?? '').substring(0, 7)
        if (mnByMo[m] !== undefined) mnByMo[m]++
      })
      const maintenanceKpi: KpiMetric = {
        value: mnOpenNow,
        trend: mnOpen30 === 0 && mnOpenNow === 0 ? 0
             : mnOpen30 === 0 ? null
             : trendPct(mnOpenNow, mnOpen30),
        spark: months.map((m) => ({ v: mnByMo[m] ?? 0 })),
      }

      // ── Checklists Pendentes — trend vs 30 dias atrás ────────
      const clPendingNow = clItems.filter(
        (c) => c.status !== 'completed' && c.status !== 'cancelled',
      ).length

      const clPending30 = clItems.filter((c) => {
        if (c.status === 'cancelled') return false
        if (new Date(c.created_at) > thirtyDaysAgo) return false
        if (c.completed_at) return new Date(c.completed_at) > thirtyDaysAgo
        if (c.status === 'completed') return false
        return true
      }).length

      const clByMo: Record<string, number> = {}
      months.forEach((m) => { clByMo[m] = 0 })
      clItems.forEach((c) => {
        const m = (c.created_at ?? '').substring(0, 7)
        if (clByMo[m] !== undefined) clByMo[m]++
      })
      const checklistsKpi: KpiMetric = {
        value: clPendingNow,
        trend: clPending30 === 0 && clPendingNow === 0 ? 0
             : clPending30 === 0 ? null
             : trendPct(clPendingNow, clPending30),
        spark: months.map((m) => ({ v: clByMo[m] ?? 0 })),
      }

      return {
        events:      eventsKpi,
        conversion:  conversionKpi,
        leads:       leadsKpi,
        maintenance: maintenanceKpi,
        checklists:  checklistsKpi,
      }
    },
  })
}
