'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'

// ── Return types ──────────────────────────────────────────────

export interface VendasMyKpis {
  total_revenue:        number
  order_count:          number
  avg_ticket:           number
  won_count:            number
  conversion_rate:      number
  prev_revenue:         number
  prev_order_count:     number
  prev_avg_ticket:      number
  prev_won_count:       number
  prev_conversion_rate: number
}

export interface VendasDailyRevenue {
  order_date:         string  // "YYYY-MM-DD"
  revenue:            number
  cumulative_revenue: number
}

export interface VendasRankingRow {
  seller_id:       string
  seller_name:     string
  total_revenue:   number
  order_count:     number
  avg_ticket:      number
  deals_won:       number
  conversion_rate: number
}

// ── Shared retry policy ───────────────────────────────────────

function vendasRetry(count: number, err: unknown): boolean {
  const status = (err as { status?: number })?.status
  return count < 3 && status !== 401 && status !== 403
}

// ── Hooks ─────────────────────────────────────────────────────

export function useVendasMyKpis(params: {
  sellerId:  string | null
  startDate: string
  endDate:   string
  prevStart: string
  prevEnd:   string
}) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { sellerId, startDate, endDate, prevStart, prevEnd } = params

  return useQuery({
    queryKey:  ['vendas', 'my-kpis', sellerId, startDate, endDate, prevStart, prevEnd],
    enabled:   isSessionReady,
    staleTime: 5 * 60 * 1000,
    networkMode: 'always',
    retry:     vendasRetry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_vendas_my_kpis', {
        p_seller_id:  sellerId,
        p_start_date: startDate,
        p_end_date:   endDate,
        p_prev_start: prevStart,
        p_prev_end:   prevEnd,
      })
      if (error) throw error
      const rows = data as VendasMyKpis[] | null
      return rows?.[0] ?? {
        total_revenue: 0, order_count: 0, avg_ticket: 0,
        won_count: 0, conversion_rate: 0,
        prev_revenue: 0, prev_order_count: 0, prev_avg_ticket: 0,
        prev_won_count: 0, prev_conversion_rate: 0,
      }
    },
  })
}

export function useVendasDailyRevenue(params: {
  sellerId:  string | null
  startDate: string
  endDate:   string
}) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { sellerId, startDate, endDate } = params

  return useQuery({
    queryKey:  ['vendas', 'daily-revenue', sellerId, startDate, endDate],
    enabled:   isSessionReady,
    staleTime: 5 * 60 * 1000,
    networkMode: 'always',
    retry:     vendasRetry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_vendas_daily_revenue', {
        p_seller_id:  sellerId,
        p_start_date: startDate,
        p_end_date:   endDate,
      })
      if (error) throw error
      return (data ?? []) as VendasDailyRevenue[]
    },
  })
}

export function useVendasRanking(params: {
  startDate: string
  endDate:   string
  unitId:    string | null
}) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)
  const { startDate, endDate, unitId } = params

  return useQuery({
    queryKey:  ['vendas', 'ranking', startDate, endDate, unitId],
    enabled:   isSessionReady,
    staleTime: 5 * 60 * 1000,
    networkMode: 'always',
    retry:     vendasRetry,
    queryFn: async () => {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_vendas_ranking', {
        p_start_date: startDate,
        p_end_date:   endDate,
        p_unit_id:    unitId,
      })
      if (error) throw error
      return (data ?? []) as VendasRankingRow[]
    },
  })
}
