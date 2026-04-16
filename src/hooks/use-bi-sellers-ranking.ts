'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'

// ── Types ─────────────────────────────────────────────────────

export type SellerRankingRow = {
  owner_name: string
  leads_count: number
  won_count: number
  lost_count: number
  open_count: number
  conversion_rate: number
  avg_ticket: number
  total_revenue: number
}

// ── Hook ──────────────────────────────────────────────────────

export function useBISellersRanking(unitId: string | null, periodMonths = 6) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['bi', 'sellers-ranking', unitId, periodMonths],
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry: (count, err: { status?: number } | null) =>
      count < 3 && err?.status !== 401 && err?.status !== 403,
    queryFn: async (): Promise<SellerRankingRow[]> => {
      const supabase = createClient()

      const { data, error } = await supabase.rpc('get_bi_sellers_ranking', {
        p_unit_id: unitId ?? null,
        p_period_months: periodMonths,
      })

      if (error) throw { status: error.code, message: error.message }

      return (data ?? []) as SellerRankingRow[]
    },
  })
}
