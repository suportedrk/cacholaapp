'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'

// ── Return types ───────────────────────────────────────────────

export interface BISalesKpi {
  total_revenue: number
  total_orders:  number
  avg_ticket:    number
}

export interface BISalesRankingRow {
  seller_id:           string
  seller_name:         string
  seller_status:       'active' | 'inactive'
  is_system_account:   boolean
  hire_date:           string | null
  termination_date:    string | null
  total_revenue:       number
  order_count:         number
  avg_ticket:          number
  months_worked:       number
  avg_monthly_revenue: number
}

export interface BISellerOrder {
  ploomes_order_id: number
  order_date:       string   // DATE string "YYYY-MM-DD"
  amount:           number
  deal_id:          number | null
  client_name:      string
  unit_name:        string
}

// ── Shared retry policy ────────────────────────────────────────

function biRetry(count: number, err: unknown): boolean {
  const status = (err as { status?: number })?.status
  return count < 3 && status !== 401 && status !== 403
}

// ── Hooks ──────────────────────────────────────────────────────

export function useBiSalesKpi(params: {
  startDate:       string
  endDate:         string
  unitId:          string | null
  includeInactive: boolean
}) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { startDate, endDate, unitId, includeInactive } = params

  return useQuery({
    queryKey:  ['bi', 'sales-kpi', startDate, endDate, unitId, includeInactive],
    enabled:   isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry:     biRetry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_bi_sales_kpi', {
        p_start_date:       startDate,
        p_end_date:         endDate,
        p_unit_id:          unitId,
        p_include_inactive: includeInactive,
      })
      if (error) throw error
      const rows = data as BISalesKpi[] | null
      return rows?.[0] ?? { total_revenue: 0, total_orders: 0, avg_ticket: 0 }
    },
  })
}

export function useBiSalesRanking(params: {
  startDate:       string
  endDate:         string
  unitId:          string | null
  includeInactive: boolean
}) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { startDate, endDate, unitId, includeInactive } = params

  return useQuery({
    queryKey:  ['bi', 'sales-ranking', startDate, endDate, unitId, includeInactive],
    enabled:   isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry:     biRetry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_bi_sales_ranking', {
        p_start_date:       startDate,
        p_end_date:         endDate,
        p_unit_id:          unitId,
        p_include_inactive: includeInactive,
      })
      if (error) throw error
      return (data ?? []) as BISalesRankingRow[]
    },
  })
}

export function useBiSellerOrders(params: {
  sellerId:  string | null
  startDate: string
  endDate:   string
  unitId:    string | null
}) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { sellerId, startDate, endDate, unitId } = params

  return useQuery({
    queryKey:  ['bi', 'seller-orders', sellerId, startDate, endDate, unitId],
    enabled:   isSessionReady && !!sellerId,
    staleTime: 5 * 60 * 1000,
    retry:     biRetry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_bi_seller_orders', {
        p_seller_id:  sellerId,
        p_start_date: startDate,
        p_end_date:   endDate,
        p_unit_id:    unitId,
      })
      if (error) throw error
      return (data ?? []) as BISellerOrder[]
    },
  })
}
