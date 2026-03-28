'use client'

import { useQuery } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth, subMonths, differenceInCalendarDays, parseISO } from 'date-fns'
import type { EventWithDetails, EventStatus, MaintenanceType } from '@/types/database.types'
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
  event_type: { id: string; name: string } | null
  venue: { id: string; name: string; capacity: number | null } | null
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


const CALENDAR_EVENT_SELECT = `
  id, title, date, start_time, end_time, status, client_name, birthday_person,
  event_type:event_types(id, name),
  venue:venues(id, name, capacity)
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
// PRÓXIMO EVENTO
// ─────────────────────────────────────────────────────────────
export function useNextEvent() {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['dashboard', 'next-event', activeUnitId],
    enabled: isSessionReady,
    queryFn: async () => {
      const supabase = createClient()
      const today = format(new Date(), 'yyyy-MM-dd')

      let q = supabase
        .from('events')
        .select(`
          *,
          event_type:event_types(id, name),
          package:packages(id, name),
          venue:venues(id, name, capacity),
          staff:event_staff(id, role_in_event, user:users(id, name, avatar_url))
        `)
        .gte('date', today)
        .not('status', 'in', '("finished","post_event","lost")')
      if (activeUnitId) q = q.eq('unit_id', activeUnitId)
      const { data, error } = await q
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      return data as unknown as EventWithDetails | null
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
        .from('maintenance_orders')
        .select('type, status, due_date')
        .not('status', 'in', '("completed","cancelled")')
      if (activeUnitId) q = q.eq('unit_id', activeUnitId)
      const { data, error } = await q

      if (error) throw error

      const orders = data ?? []
      const open = orders.length
      const urgentToday = orders.filter((o) =>
        o.type === 'emergency' ||
        (o.due_date && o.due_date.split('T')[0] <= today)
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
export function useCalendarMaintenance(dateFrom: string, dateTo: string, enabled: boolean) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  return useQuery({
    queryKey: ['dashboard', 'calendar-maintenance', dateFrom, dateTo, activeUnitId],
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('maintenance_orders')
        .select('id, title, type, status, due_date, sector:sectors(id, name)')
        .gte('due_date', `${dateFrom}T00:00:00`)
        .lte('due_date', `${dateTo}T23:59:59`)
        .not('status', 'in', '("completed","cancelled")')
        .order('due_date', { ascending: true })
      if (activeUnitId) q = q.eq('unit_id', activeUnitId)
      const { data, error } = await q

      if (error) throw error
      return (data ?? []).map((o) => ({
        id: o.id,
        title: o.title,
        date: o.due_date ? o.due_date.split('T')[0] : '',
        type: o.type,
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
  events:      KpiMetric  // total events this month
  conversion:  KpiMetric  // % confirmed / total this month
  guests:      KpiMetric  // sum guest_count this month
  maintenance: KpiMetric  // currently open orders (spark = new/month)
  checklists:  KpiMetric  // currently pending (spark = new/month)
  nextEventDays: number | null
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
    queryFn: async (): Promise<DashboardKpis> => {
      const supabase  = createClient()
      const now       = new Date()
      const rangeStart = startOfMonth(subMonths(now, 5))
      const months    = buildMonths(now, 6)
      const curMo     = months[5]   // current month 'yyyy-MM'
      const prevMo    = months[4]   // previous month
      const today     = format(now, 'yyyy-MM-dd')

      // ── Build queries ────────────────────────────────────────
      const evQ = (() => {
        let q = supabase
          .from('events')
          .select('date, status, guest_count')
          .gte('date', format(rangeStart, 'yyyy-MM-dd'))
          .neq('status', 'lost')
        if (activeUnitId) q = q.eq('unit_id', activeUnitId)
        return q
      })()

      const mnQ = (() => {
        let q = supabase
          .from('maintenance_orders')
          .select('created_at, status')
        if (activeUnitId) q = q.eq('unit_id', activeUnitId)
        return q
      })()

      const clQ = (() => {
        let q = supabase
          .from('checklists')
          .select('created_at, status')
        if (activeUnitId) q = q.eq('unit_id', activeUnitId)
        return q
      })()

      const nextQ = (() => {
        let q = supabase
          .from('events')
          .select('date')
          .gte('date', today)
          .not('status', 'in', '("finished","post_event","lost")')
          .order('date', { ascending: true })
          .limit(1)
        if (activeUnitId) q = q.eq('unit_id', activeUnitId)
        return q.maybeSingle()
      })()

      const [evRes, mnRes, clRes, nextRes] = await Promise.all([evQ, mnQ, clQ, nextQ])

      const events   = evRes.data   ?? []
      const mnOrders = mnRes.data   ?? []
      const clItems  = clRes.data   ?? []
      const nextEv   = nextRes.data

      // ── Events by month ──────────────────────────────────────
      type EvBucket = { count: number; confirmed: number; guests: number }
      const evByMo: Record<string, EvBucket> = {}
      months.forEach((m) => { evByMo[m] = { count: 0, confirmed: 0, guests: 0 } })
      events.forEach((e) => {
        const m = e.date.substring(0, 7)
        if (evByMo[m]) {
          evByMo[m].count++
          if (e.status === 'confirmed') evByMo[m].confirmed++
          // Sanity check: cap guest_count to avoid corrupted Ploomes values
          const gc = e.guest_count as number | null
          if (typeof gc === 'number' && gc > 0 && gc <= 9999) {
            evByMo[m].guests += gc
          }
        }
      })

      const eventsKpi: KpiMetric = {
        value: evByMo[curMo]?.count ?? 0,
        trend: trendPct(evByMo[curMo]?.count ?? 0, evByMo[prevMo]?.count ?? 0),
        spark: months.map((m) => ({ v: evByMo[m]?.count ?? 0 })),
      }

      const toCvt = (m: string) => {
        const d = evByMo[m]
        return d && d.count > 0 ? Math.round((d.confirmed / d.count) * 100) : 0
      }
      const conversionKpi: KpiMetric = {
        value: toCvt(curMo),
        trend: trendPct(toCvt(curMo), toCvt(prevMo)),
        spark: months.map((m) => ({ v: toCvt(m) })),
      }

      const gCur  = evByMo[curMo]?.guests  ?? 0
      const gPrev = evByMo[prevMo]?.guests ?? 0
      const guestsKpi: KpiMetric = {
        value: gCur,
        trend: trendPct(gCur, gPrev),
        spark: months.map((m) => ({ v: evByMo[m]?.guests ?? 0 })),
      }

      // ── Maintenance ──────────────────────────────────────────
      const mnOpenNow = mnOrders.filter(
        (o) => o.status !== 'completed' && o.status !== 'cancelled',
      ).length
      const mnByMo: Record<string, number> = {}
      months.forEach((m) => { mnByMo[m] = 0 })
      mnOrders.forEach((o) => {
        const m = (o.created_at ?? '').substring(0, 7)
        if (mnByMo[m] !== undefined) mnByMo[m]++
      })
      const maintenanceKpi: KpiMetric = {
        value: mnOpenNow,
        trend: trendPct(mnByMo[curMo] ?? 0, mnByMo[prevMo] ?? 0),
        spark: months.map((m) => ({ v: mnByMo[m] ?? 0 })),
      }

      // ── Checklists ───────────────────────────────────────────
      const clPendingNow = clItems.filter(
        (c) => c.status !== 'completed' && c.status !== 'cancelled',
      ).length
      const clByMo: Record<string, number> = {}
      months.forEach((m) => { clByMo[m] = 0 })
      clItems.forEach((c) => {
        const m = (c.created_at ?? '').substring(0, 7)
        if (clByMo[m] !== undefined) clByMo[m]++
      })
      const checklistsKpi: KpiMetric = {
        value: clPendingNow,
        trend: trendPct(clByMo[curMo] ?? 0, clByMo[prevMo] ?? 0),
        spark: months.map((m) => ({ v: clByMo[m] ?? 0 })),
      }

      // ── Next event days ──────────────────────────────────────
      let nextEventDays: number | null = null
      if (nextEv?.date) {
        const diff = differenceInCalendarDays(parseISO(`${nextEv.date}T12:00:00`), now)
        nextEventDays = Math.max(0, diff)
      }

      return {
        events:      eventsKpi,
        conversion:  conversionKpi,
        guests:      guestsKpi,
        maintenance: maintenanceKpi,
        checklists:  checklistsKpi,
        nextEventDays,
      }
    },
    staleTime: 2 * 60 * 1000,
  })
}
