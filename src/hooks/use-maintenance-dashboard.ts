'use client'

import { useQuery } from '@tanstack/react-query'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import { createClient } from '@/lib/supabase/client'
import type { MaintenanceStatsResponse } from '@/app/api/maintenance/stats/route'
import type { TicketStatus, TicketNature, TicketUrgency } from '@/types/database.types'

// Re-export for page use
export type { MaintenanceStatsResponse }

export type PeriodDays = 30 | 60 | 90

// ── useMaintenanceDashboardStats ──────────────────────────────────────────
export function useMaintenanceDashboardStats() {
  const { activeUnitId }  = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery<MaintenanceStatsResponse>({
    queryKey: ['maintenance-stats', activeUnitId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (activeUnitId) params.set('unit_id', activeUnitId)
      const res = await fetch(`/api/maintenance/stats?${params}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw Object.assign(new Error(err.error ?? 'Erro ao carregar estatisticas'), { status: res.status })
      }
      return res.json()
    },
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    networkMode: 'always',
    retry: (count, err: unknown) => {
      const status = (err as { status?: number }).status
      return count < 2 && status !== 401 && status !== 403
    },
  })
}

// ── useMaintenanceTicketsTrend ────────────────────────────────────────────
export type WeekBucket = {
  week:      string
  total:     number
  concluded: number
  open:      number
}

export function useMaintenanceTicketsTrend(days: PeriodDays = 90) {
  const { activeUnitId }   = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery<WeekBucket[]>({
    queryKey: ['maintenance-trend', activeUnitId, days],
    queryFn: async () => {
      const supabase = createClient()
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      let q = supabase
        .from('maintenance_tickets')
        .select('created_at, status, concluded_at')
        .gte('created_at', since)
        .order('created_at', { ascending: true })

      if (activeUnitId) q = q.eq('unit_id', activeUnitId)

      const { data, error } = await q
      if (error) throw error

      const buckets: Record<string, WeekBucket> = {}
      for (const t of data ?? []) {
        const d      = new Date(t.created_at)
        const dow    = (d.getDay() + 6) % 7
        const monday = new Date(d)
        monday.setDate(d.getDate() - dow)
        monday.setHours(0, 0, 0, 0)
        const key = monday.toISOString().slice(0, 10)
        if (!buckets[key]) {
          const label = monday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          buckets[key] = { week: label, total: 0, concluded: 0, open: 0 }
        }
        buckets[key].total++
        if (t.status === 'concluded') buckets[key].concluded++
        else if (t.status !== 'cancelled') buckets[key].open++
      }

      return Object.values(buckets)
    },
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    networkMode: 'always',
    retry: (count, err: unknown) => {
      const e = err as { code?: string }
      return count < 2 && e?.code !== '401'
    },
  })
}

// ── useMaintenanceTicketsPeriod ───────────────────────────────────────────
// concluded_at and due_at are nullable optionals in the DB schema
export type TicketSummary = {
  id:           string
  title:        string
  nature:       TicketNature
  urgency:      TicketUrgency
  status:       TicketStatus
  created_at:   string
  concluded_at: string | null | undefined
  due_at:       string | null | undefined
  sector_id:    string | null | undefined
  sector_name:  string | null
}

export function useMaintenanceTicketsPeriod(days: PeriodDays) {
  const { activeUnitId }   = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery<TicketSummary[]>({
    queryKey: ['maintenance-period', activeUnitId, days],
    queryFn: async () => {
      const supabase = createClient()
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

      // Fetch without join to avoid Supabase type inference issues
      // sector_id is available directly for lookup
      let q = supabase
        .from('maintenance_tickets')
        .select('id, title, nature, urgency, status, created_at, concluded_at, due_at, sector_id')
        .gte('created_at', since)
        .order('created_at', { ascending: false })

      if (activeUnitId) q = q.eq('unit_id', activeUnitId)

      const { data, error } = await q
      if (error) throw error

      // Fetch sector names in a single batch query if we have any sector_ids
      const sectorIds = [...new Set((data ?? []).map((t) => t.sector_id).filter(Boolean))] as string[]
      const sectorMap: Record<string, string> = {}

      if (sectorIds.length > 0) {
        const { data: sectors } = await supabase
          .from('maintenance_sectors')
          .select('id, name')
          .in('id', sectorIds)
        for (const s of sectors ?? []) {
          sectorMap[s.id] = s.name
        }
      }

      return (data ?? []).map((t) => ({
        ...t,
        sector_name: t.sector_id ? (sectorMap[t.sector_id] ?? null) : null,
      }))
    },
    enabled: isSessionReady,
    staleTime: 3 * 60 * 1000,
    networkMode: 'always',
    retry: (count, err: unknown) => {
      const e = err as { code?: string }
      return count < 2 && e?.code !== '401'
    },
  })
}
