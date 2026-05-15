'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'

export interface BIAdoptionKpi {
  total_orders:       number
  orders_preenchidas: number
  percentual_adocao:  number
}

export interface BIAdoptionRankingRow {
  seller_id:          number
  seller_name:        string
  seller_status:      string
  is_system_account:  boolean
  total_orders:       number
  orders_preenchidas: number
  percentual_adocao:  number
}

interface Params {
  startDate:       string
  endDate:         string
  unitId:          string | null
  includeInactive: boolean
}

export function useBiAdoptionKpi(params: Params) {
  const supabase        = createClient()
  const isSessionReady  = useAuthReadyStore((s: { isSessionReady: boolean }) => s.isSessionReady)
  const { startDate, endDate, unitId, includeInactive } = params

  return useQuery<BIAdoptionKpi>({
    queryKey: ['bi', 'adoption-kpi', startDate, endDate, unitId, includeInactive],
    enabled:  isSessionReady,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_bi_adoption_kpi', {
        p_start_date:       startDate,
        p_end_date:         endDate,
        p_unit_id:          unitId ?? null,
        p_include_inactive: includeInactive,
      })
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      return {
        total_orders:       Number(row?.total_orders       ?? 0),
        orders_preenchidas: Number(row?.orders_preenchidas ?? 0),
        percentual_adocao:  Number(row?.percentual_adocao  ?? 0),
      }
    },
  })
}

export function useBiAdoptionRanking(params: Params) {
  const supabase        = createClient()
  const isSessionReady  = useAuthReadyStore((s: { isSessionReady: boolean }) => s.isSessionReady)
  const { startDate, endDate, unitId, includeInactive } = params

  return useQuery<BIAdoptionRankingRow[]>({
    queryKey: ['bi', 'adoption-ranking', startDate, endDate, unitId, includeInactive],
    enabled:  isSessionReady,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('get_bi_adoption_ranking', {
        p_start_date:       startDate,
        p_end_date:         endDate,
        p_unit_id:          unitId ?? null,
        p_include_inactive: includeInactive,
      })
      if (error) throw error
      return (data ?? []).map((r: BIAdoptionRankingRow) => ({
        seller_id:          Number(r.seller_id),
        seller_name:        r.seller_name,
        seller_status:      r.seller_status,
        is_system_account:  r.is_system_account,
        total_orders:       Number(r.total_orders),
        orders_preenchidas: Number(r.orders_preenchidas),
        percentual_adocao:  Number(r.percentual_adocao),
      }))
    },
  })
}
