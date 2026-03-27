'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import type { EventWithDetails, EventStatus } from '@/types/database.types'

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
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => {
      const supabase = createClient()
      const now = new Date()
      const monthStart = format(startOfMonth(now), 'yyyy-MM-dd')
      const monthEnd   = format(endOfMonth(now),   'yyyy-MM-dd')

      const { data, error } = await supabase
        .from('events')
        .select('status, date')
        .gte('date', monthStart)
        .lte('date', monthEnd)

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
  return useQuery({
    queryKey: ['dashboard', 'next-event'],
    queryFn: async () => {
      const supabase = createClient()
      const today = format(new Date(), 'yyyy-MM-dd')

      const { data, error } = await supabase
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
// EVENTOS DO CALENDÁRIO (range de datas)
// ─────────────────────────────────────────────────────────────
export function useCalendarEvents(dateFrom: string, dateTo: string) {
  return useQuery({
    queryKey: ['dashboard', 'calendar', dateFrom, dateTo],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('events')
        .select(CALENDAR_EVENT_SELECT)
        .gte('date', dateFrom)
        .lte('date', dateTo)
        .order('date', { ascending: true })
        .order('start_time', { ascending: true })

      if (error) throw error
      return (data ?? []) as unknown as CalendarEvent[]
    },
    staleTime: 30 * 1000,
    enabled: !!dateFrom && !!dateTo,
  })
}
