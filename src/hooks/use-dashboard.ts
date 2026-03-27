'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import type { EventWithDetails, EventStatus, MaintenanceType } from '@/types/database.types'
import { useUnitStore } from '@/stores/unit-store'

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
  return useQuery({
    queryKey: ['dashboard', 'stats', activeUnitId],
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
  return useQuery({
    queryKey: ['dashboard', 'next-event', activeUnitId],
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
        .not('status', 'in', '("finished","post_event")')
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
  return useQuery({
    queryKey: ['dashboard', 'maintenance-stats', activeUnitId],
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
  return useQuery({
    queryKey: ['dashboard', 'calendar', dateFrom, dateTo, activeUnitId],
    queryFn: async () => {
      const supabase = createClient()
      let q = supabase
        .from('events')
        .select(CALENDAR_EVENT_SELECT)
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })
      if (activeUnitId) q = q.eq('unit_id', activeUnitId)
      const { data, error } = await q

      if (error) throw error
      return (data ?? []) as unknown as CalendarEvent[]
    },
    staleTime: 30 * 1000,
    enabled: !!dateFrom && !!dateTo,
  })
}

// ─────────────────────────────────────────────────────────────
// MANUTENÇÕES DO CALENDÁRIO (por due_date)
// ─────────────────────────────────────────────────────────────
export function useCalendarMaintenance(dateFrom: string, dateTo: string, enabled: boolean) {
  const { activeUnitId } = useUnitStore()
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
    enabled: enabled && !!dateFrom && !!dateTo,
  })
}
