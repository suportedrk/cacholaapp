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
  unit_id: string | null
  unit: { slug: string | null } | null
  // event_types e venues foram dropadas na migration 030
  entityType?: 'event'  // default
}

export type CalendarMaintenance = {
  id: string
  title: string
  date: string          // 'YYYY-MM-DD' — due_at ou scheduled_at conforme a regra de dedup
  type: MaintenanceType
  status: string
  sector: { id: string; name: string } | null
  entityType: 'maintenance'
  /** true = item vem de uma execução agendada (scheduled_at); false/undefined = vem do due_at */
  scheduled?: boolean
  /** Nome do executor da execução agendada (usuário interno ou prestador), quando disponível */
  executor_name?: string | null
}

export type DashboardMaintenanceStats = {
  open: number
  urgentToday: number   // emergenciais abertas ou atrasadas
}


// event_types e venues foram dropadas na migration 030
const CALENDAR_EVENT_SELECT = `
  id, title, date, start_time, end_time, status, client_name, birthday_person, owner_name, unit_id, unit:units(slug)
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

      // Q1 — chamados pelo due_at (comportamento original)
      let ticketsQ = supabase
        .from('maintenance_tickets')
        .select('id, title, nature, status, due_at, sector:maintenance_sectors(id, name)')
        .gte('due_at', `${dateFrom}T00:00:00`)
        .lte('due_at', `${dateTo}T23:59:59`)
        .not('status', 'in', '("concluded","cancelled")')
        .order('due_at', { ascending: true })
      if (activeUnitId) ticketsQ = ticketsQ.eq('unit_id', activeUnitId)

      // Q2 — execuções agendadas (scheduled_at) no período
      // Usa (supabase as any) porque maintenance_executions não tem relações em database.types.ts
      const execQ = (supabase as ReturnType<typeof createClient> & { from: (t: string) => unknown } as any)
        .from('maintenance_executions')
        .select(`
          id, ticket_id, executor_type, scheduled_at,
          internal_user:users!internal_user_id(id, name),
          provider:service_providers!provider_id(id, name),
          ticket:maintenance_tickets!ticket_id(
            id, title, nature, status, unit_id,
            sector:maintenance_sectors(id, name)
          )
        `)
        .gte('scheduled_at', `${dateFrom}T00:00:00`)
        .lte('scheduled_at', `${dateTo}T23:59:59`)
        .order('scheduled_at', { ascending: true })

      const [
        { data: ticketsData, error: ticketsError },
        { data: execRaw, error: execError },
      ] = await Promise.all([ticketsQ, execQ as Promise<{ data: unknown[]; error: unknown }>])
      const execData = execRaw as Array<{
        id: string
        ticket_id: string
        executor_type: string
        scheduled_at: string | null
        internal_user: { id: string; name: string } | null
        provider: { id: string; name: string } | null
        ticket: {
          id: string; title: string; nature: string; status: string
          unit_id: string; sector: { id: string; name: string } | null
        } | null
      }> | null

      if (ticketsError) throw ticketsError
      if (execError) throw execError

      // Filtrar execuções: unidade (client-side, padrão de use-maintenance-schedule.ts)
      // e ticket não pode estar concluído/cancelado
      const validExecs = (execData ?? []).filter((e) => {
        const t = e.ticket
        if (!t) return false
        if (t.status === 'concluded' || t.status === 'cancelled') return false
        return !activeUnitId || t.unit_id === activeUnitId
      })

      // IDs de chamados que têm QUALQUER execução agendada na janela
      // → esses chamados NÃO aparecem pelo due_at (o prazo cede ao agendamento)
      const scheduledTicketIds = new Set(validExecs.map((e) => e.ticket_id))

      // Itens por due_at (excluídos os que têm execução agendada)
      const ticketItems = (ticketsData ?? [])
        .filter((o) => !scheduledTicketIds.has(o.id))
        .map((o) => ({
          id: o.id,
          title: o.title,
          date: o.due_at ? o.due_at.split('T')[0] : '',
          type: (NATURE_TO_TYPE[o.nature] ?? 'punctual') as MaintenanceType,
          status: o.status,
          sector: o.sector as unknown as { id: string; name: string } | null,
          entityType: 'maintenance' as const,
          scheduled: false,
          executor_name: null as string | null,
        }))

      // Itens por scheduled_at — UMA entrada por execução agendada
      // Chamados com múltiplas execuções na janela geram múltiplos itens (um por dia agendado)
      const execItems = validExecs.map((e) => {
        const t = e.ticket!
        return {
          id: t.id,
          title: t.title,
          date: e.scheduled_at ? e.scheduled_at.split('T')[0] : '',
          type: (NATURE_TO_TYPE[t.nature] ?? 'punctual') as MaintenanceType,
          status: t.status,
          sector: t.sector as unknown as { id: string; name: string } | null,
          entityType: 'maintenance' as const,
          scheduled: true,
          executor_name: e.internal_user?.name ?? e.provider?.name ?? null,
        }
      })

      return [...ticketItems, ...execItems] satisfies CalendarMaintenance[]
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
  conversion:  KpiMetric  // confirmed / (confirmed + lost) by event date month
  leads:       KpiMetric  // leads created this month in Ploomes (all status_id, by ploomes_create_date)
  maintenance: KpiMetric  // currently open orders (trend vs 30 days ago)
  undecided:   KpiMetric  // leads this month with unit_option_name = 'Cliente ainda não sabe' (always absolute)
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

      // ── Q1: eventos por data da festa (para Eventos do Mês + Taxa de Conversão)
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

      // ── Q2: deals dos últimos 6 meses (para Leads do Mês + Cliente ainda não sabe)
      // Sem filtro de unidade — filtramos client-side via unit_option_name.
      // RLS permite ver deals da unidade do usuário + "Cliente ainda não sabe" (migrations 083+084).
      // `unit_option_name` adicionado em migration 083 — database.types.ts ainda não regenerado.
      const dealsQ = (supabase as any)
        .from('ploomes_deals')
        .select('ploomes_create_date, unit_option_name')
        .gte('ploomes_create_date', format(rangeStart, 'yyyy-MM-dd'))
        .order('ploomes_create_date', { ascending: false })
        .limit(5000) as
        Promise<{ data: { ploomes_create_date: string; unit_option_name: string | null }[] | null; error: unknown }>

      // ── Q3: mapeamento unit_id → ploomes_value (para filtrar Leads por unidade)
      // Necessário para traduzir activeUnitId (UUID) → unit_option_name (string do Ploomes).
      const mappingQ = activeUnitId
        ? (supabase as ReturnType<typeof createClient>)
            .from('ploomes_unit_mapping')
            .select('ploomes_value')
            .eq('unit_id', activeUnitId)
            .eq('is_active', true)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null })

      // ── Q4: chamados de manutenção (sem filtro de data, para KPI maintenance)
      const mnQ = (() => {
        let q = supabase
          .from('maintenance_tickets')
          .select('created_at, status, concluded_at')
        if (activeUnitId) q = q.eq('unit_id', activeUnitId)
        return q
      })()

      const [evRes, dealsRes, mappingRes, mnRes] = await Promise.all([
        evQ, dealsQ, mappingQ, mnQ,
      ])

      const evAll    = evRes.data    ?? []
      const allDeals = dealsRes.data ?? []
      const mnOrders = mnRes.data    ?? []

      // ── Buckets por mês (data da festa) — para Eventos e Conversão ──
      type EvBucket = { confirmed: number; lost: number }
      const evByMo: Record<string, EvBucket> = {}
      months.forEach((m) => { evByMo[m] = { confirmed: 0, lost: 0 } })
      evAll.forEach((e) => {
        const m = e.date.substring(0, 7)
        if (!evByMo[m]) return
        if (e.status === 'confirmed') evByMo[m].confirmed++
        else if (e.status === 'lost') evByMo[m].lost++
      })

      // ── Eventos do Mês — festas confirmadas com data da festa no mês ──
      const eventsKpi: KpiMetric = {
        value: evByMo[curMo]?.confirmed ?? 0,
        trend: trendPct(evByMo[curMo]?.confirmed ?? 0, evByMo[prevMo]?.confirmed ?? 0),
        spark: months.map((m) => ({ v: evByMo[m]?.confirmed ?? 0 })),
      }

      // ── Taxa de Conversão — confirmed / (confirmed + lost) por data da festa ──
      const totalEvForMo = (m: string) =>
        (evByMo[m]?.confirmed ?? 0) + (evByMo[m]?.lost ?? 0)
      const toCvt = (m: string): number => {
        const total = totalEvForMo(m)
        return total > 0 ? Math.round(((evByMo[m]?.confirmed ?? 0) / total) * 100) : 0
      }
      const conversionKpi: KpiMetric = {
        value: toCvt(curMo),
        trend: totalEvForMo(curMo) > 0 ? trendPct(toCvt(curMo), toCvt(prevMo)) : null,
        spark: months.map((m) => ({ v: toCvt(m) })),
      }

      // ── Leads do Mês — deals criados no mês (por ploomes_create_date) ──
      // Filtro por unidade: usa unit_option_name em vez de unit_id para não perder
      // o valor semântico original do Ploomes (ex: "Cachola PINHEIROS").
      // Quando activeUnitId=null (todas as unidades), inclui "Cliente ainda não sabe".
      const unitOptFilter = (mappingRes as { data: { ploomes_value: string } | null }).data?.ploomes_value ?? null
      const leadsDeals = unitOptFilter
        ? allDeals.filter((d) => d.unit_option_name === unitOptFilter)
        : allDeals

      // ── Cliente ainda não sabe — sempre absoluto, sem filtro de unidade ──
      const undecidedDeals = allDeals.filter((d) => d.unit_option_name === 'Cliente ainda não sabe')

      // Buckets por mês (ploomes_create_date)
      const leadsByMo: Record<string, number>     = {}
      const undecidedByMo: Record<string, number> = {}
      months.forEach((m) => { leadsByMo[m] = 0; undecidedByMo[m] = 0 })

      leadsDeals.forEach((d) => {
        const m = (d.ploomes_create_date as string).substring(0, 7)
        if (leadsByMo[m] !== undefined) leadsByMo[m]++
      })
      undecidedDeals.forEach((d) => {
        const m = (d.ploomes_create_date as string).substring(0, 7)
        if (undecidedByMo[m] !== undefined) undecidedByMo[m]++
      })

      const leadsKpi: KpiMetric = {
        value: leadsByMo[curMo] ?? 0,
        trend: trendPct(leadsByMo[curMo] ?? 0, leadsByMo[prevMo] ?? 0),
        spark: months.map((m) => ({ v: leadsByMo[m] ?? 0 })),
      }

      const undecidedKpi: KpiMetric = {
        value: undecidedByMo[curMo] ?? 0,
        trend: trendPct(undecidedByMo[curMo] ?? 0, undecidedByMo[prevMo] ?? 0),
        spark: months.map((m) => ({ v: undecidedByMo[m] ?? 0 })),
      }

      // ── Manutenções Abertas — trend vs 30 dias atrás ─────────
      const mnOpenNow = mnOrders.filter(
        (o) => o.status !== 'concluded' && o.status !== 'cancelled',
      ).length

      const mnOpen30 = mnOrders.filter((o) => {
        if (o.status === 'cancelled') return false
        if (new Date(o.created_at) > thirtyDaysAgo) return false
        if (o.concluded_at) return new Date(o.concluded_at) > thirtyDaysAgo
        if (o.status === 'concluded') return false
        return true
      }).length

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

      return {
        events:      eventsKpi,
        conversion:  conversionKpi,
        leads:       leadsKpi,
        maintenance: maintenanceKpi,
        undecided:   undecidedKpi,
      }
    },
  })
}
