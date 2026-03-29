'use client'

import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import type { MaintenanceType } from '@/types/database.types'
import type { HistorySummaryResponse } from '@/app/api/maintenance/history-summary/route'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
export type HistoryFilters = {
  date_from?:   string
  date_to?:     string
  type?:        MaintenanceType[]
  sector_id?:   string
  supplier_id?: string
}

export type HistoryOrderItem = {
  id:             string
  title:          string
  type:           MaintenanceType
  priority:       string
  description:    string | null
  created_at:     string
  completed_at:   string | null
  cost_estimate:  number | null
  sector:   { id: string; name: string } | null
  supplier: { id: string; company_name: string } | null
  creator:  { id: string; name: string; avatar_url: string | null } | null
}

const HISTORY_SELECT = `
  id, title, type, priority, description, created_at, completed_at, cost_estimate,
  sector:sectors(id, name),
  supplier:maintenance_suppliers!supplier_id(id, company_name),
  creator:users!maintenance_orders_created_by_fkey(id, name, avatar_url)
` as const

const PAGE_SIZE = 20

// ─────────────────────────────────────────────────────────────
// HISTORY LIST (infinite scroll)
// ─────────────────────────────────────────────────────────────
export function useMaintenanceHistory(filters: HistoryFilters = {}) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady   = useAuthReadyStore((s) => s.isSessionReady)

  return useInfiniteQuery({
    queryKey: ['maintenance-history', activeUnitId, filters],
    enabled:  !!activeUnitId && isSessionReady,
    staleTime: 60 * 1000,
    initialPageParam: 0,
    getNextPageParam: (lastPage: HistoryOrderItem[], _allPages, lastPageParam: number) =>
      lastPage.length === PAGE_SIZE ? (lastPageParam as number) + PAGE_SIZE : undefined,
    queryFn: async ({ pageParam }) => {
      const supabase = createClient()
      const offset = pageParam as number

      let q = supabase
        .from('maintenance_orders')
        .select(HISTORY_SELECT)
        .eq('unit_id', activeUnitId!)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)

      if (filters.date_from)   q = q.gte('completed_at', filters.date_from)
      if (filters.date_to)     q = q.lte('completed_at', filters.date_to)
      if (filters.type?.length) q = q.in('type', filters.type)
      if (filters.sector_id)   q = q.eq('sector_id', filters.sector_id)
      if (filters.supplier_id) q = q.eq('supplier_id', filters.supplier_id)

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as HistoryOrderItem[]
    },
  })
}

// ─────────────────────────────────────────────────────────────
// HISTORY SUMMARY (KPIs + trend chart)
// ─────────────────────────────────────────────────────────────
export function useHistorySummary(filters: HistoryFilters = {}) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady   = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['maintenance-history-summary', activeUnitId, filters],
    enabled:  !!activeUnitId && isSessionReady,
    staleTime: 2 * 60 * 1000,
    retry: (failureCount, error: unknown) => {
      const status = (error as { status?: number })?.status
      if (status === 401 || status === 403) return false
      return failureCount < 2
    },
    queryFn: async () => {
      const params = new URLSearchParams({ unit_id: activeUnitId! })
      if (filters.date_from)    params.set('date_from',   filters.date_from)
      if (filters.date_to)      params.set('date_to',     filters.date_to)
      if (filters.type?.length) params.set('type',        filters.type.join(','))
      if (filters.sector_id)    params.set('sector_id',   filters.sector_id)
      if (filters.supplier_id)  params.set('supplier_id', filters.supplier_id)

      const res = await fetch(`/api/maintenance/history-summary?${params.toString()}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw Object.assign(new Error(body.error ?? 'Erro ao carregar histórico'), { status: res.status })
      }
      return res.json() as Promise<HistorySummaryResponse>
    },
  })
}

// ─────────────────────────────────────────────────────────────
// HELPER — format resolution time
// ─────────────────────────────────────────────────────────────
export function formatResolutionTime(hours: number): string {
  if (hours < 1)  return `${Math.round(hours * 60)}min`
  if (hours < 24) return `${Math.round(hours * 10) / 10}h`
  const days = Math.round(hours / 24)
  return `${days} ${days === 1 ? 'dia' : 'dias'}`
}

export function calcResolutionHours(createdAt: string, completedAt: string | null): number | null {
  if (!completedAt) return null
  const h = (new Date(completedAt).getTime() - new Date(createdAt).getTime()) / 3_600_000
  return h >= 0 ? Math.round(h * 10) / 10 : null
}
