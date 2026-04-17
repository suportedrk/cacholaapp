'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'

// ── Return types ───────────────────────────────────────────────

export interface BICategoryKpi {
  total_categories:     number
  top_category_name:    string | null
  top_category_revenue: number | null
  total_items:          number
}

export interface BICategoryRankingRow {
  category:           string
  /** Populated only when p_group_by_unit = true (e.g. "Cachola PINHEIROS") */
  unit_family:        string | null
  revenue:            number
  product_count:      number
  avg_product_ticket: number
  pct_of_total:       number
}

export interface BICategoryDrilldownRow {
  kind:          'product' | 'seller'
  item_name:     string | null
  item_revenue:  number
  item_count:    number
  item_avg:      number
  rank_position: number
}

export interface BICategoryCrossUnitRow {
  order_unit_name: string
  product_family:  string
  item_count:      number
  revenue:         number
}

// ── Shared retry policy ────────────────────────────────────────

function biRetry(count: number, err: unknown): boolean {
  const status = (err as { status?: number })?.status
  return count < 3 && status !== 401 && status !== 403
}

// ── Hooks ──────────────────────────────────────────────────────

export function useBiCategoryKpi(params: {
  startDate:       string
  endDate:         string
  unitId:          string | null
  includeInactive: boolean
}) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { startDate, endDate, unitId, includeInactive } = params

  return useQuery({
    queryKey:  ['bi', 'category-kpi', startDate, endDate, unitId, includeInactive],
    enabled:   isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry:     biRetry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_bi_category_kpi', {
        p_start_date:       startDate,
        p_end_date:         endDate,
        p_unit_id:          unitId,
        p_include_inactive: includeInactive,
      })
      if (error) throw error
      const rows = data as BICategoryKpi[] | null
      return rows?.[0] ?? {
        total_categories:     0,
        top_category_name:    null,
        top_category_revenue: null,
        total_items:          0,
      }
    },
  })
}

export function useBiCategoryRanking(params: {
  startDate:       string
  endDate:         string
  unitId:          string | null
  includeInactive: boolean
  groupByUnit?:    boolean
}) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { startDate, endDate, unitId, includeInactive, groupByUnit = false } = params

  return useQuery({
    queryKey:  ['bi', 'category-ranking', startDate, endDate, unitId, includeInactive, groupByUnit],
    enabled:   isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry:     biRetry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_bi_category_ranking', {
        p_start_date:       startDate,
        p_end_date:         endDate,
        p_unit_id:          unitId,
        p_include_inactive: includeInactive,
        p_group_by_unit:    groupByUnit,
      })
      if (error) throw error
      return (data ?? []) as BICategoryRankingRow[]
    },
  })
}

export function useBiCategoryDrilldown(params: {
  category:        string | null
  startDate:       string
  endDate:         string
  unitId:          string | null
  includeInactive: boolean
}) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { category, startDate, endDate, unitId, includeInactive } = params

  return useQuery({
    queryKey:  ['bi', 'category-drilldown', category, startDate, endDate, unitId, includeInactive],
    enabled:   isSessionReady && !!category,
    staleTime: 5 * 60 * 1000,
    retry:     biRetry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_bi_category_drilldown', {
        p_category:         category,
        p_start_date:       startDate,
        p_end_date:         endDate,
        p_unit_id:          unitId,
        p_include_inactive: includeInactive,
      })
      if (error) throw error
      return (data ?? []) as BICategoryDrilldownRow[]
    },
  })
}

export function useBiCategoryCrossUnit(params: {
  startDate:       string
  endDate:         string
  includeInactive: boolean
}) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { startDate, endDate, includeInactive } = params

  return useQuery({
    queryKey:  ['bi', 'category-cross-unit', startDate, endDate, includeInactive],
    enabled:   isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry:     biRetry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_bi_category_cross_unit', {
        p_start_date:       startDate,
        p_end_date:         endDate,
        p_include_inactive: includeInactive,
      })
      if (error) throw error
      return (data ?? []) as BICategoryCrossUnitRow[]
    },
  })
}
