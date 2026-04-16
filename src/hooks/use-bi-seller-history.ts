'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'

// ── Types ─────────────────────────────────────────────────────

export type SellerHistoryPoint = {
  month_label: string      // 'YYYY-MM'
  leads_count: number
  won_count: number
  revenue: number
  avg_days_to_close: number | null
}

// ── Hook ──────────────────────────────────────────────────────

export function useBISellerHistory(
  ownerName: string | null,
  unitId: string | null,
  periodMonths = 6,
) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['bi', 'seller-history', ownerName, unitId, periodMonths],
    enabled: isSessionReady && !!ownerName,
    staleTime: 5 * 60 * 1000,
    retry: (count, err: { status?: number } | null) =>
      count < 3 && err?.status !== 401 && err?.status !== 403,
    queryFn: async (): Promise<SellerHistoryPoint[]> => {
      const supabase = createClient()

      const { data, error } = await supabase.rpc('get_bi_seller_history', {
        p_owner_name: ownerName!,
        p_unit_id: unitId ?? null,
        p_period_months: periodMonths,
      })

      if (error) throw { status: error.code, message: error.message }

      return (data ?? []) as SellerHistoryPoint[]
    },
  })
}
