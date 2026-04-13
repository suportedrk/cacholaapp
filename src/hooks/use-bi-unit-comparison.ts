'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useAuthReadyStore } from '@/stores/auth-store'

// ── Types ─────────────────────────────────────────────────────

export type UnitComparisonRow = {
  unit_id: string
  unit_name: string
  total_leads: number
  won_leads: number
  conversion_rate: number | null
  total_revenue: number
  avg_ticket: number | null
  avg_closing_days: number | null
  avg_booking_advance: number | null
}

// ── Hook ──────────────────────────────────────────────────────

/**
 * Comparison across ALL units — intentionally ignores activeUnitId.
 * This widget exists to compare units side-by-side.
 */
export function useBIUnitComparison(months = 7) {
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['bi', 'unit-comparison', months],
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry: (count, err: { status?: number } | null) =>
      count < 3 && err?.status !== 401 && err?.status !== 403,
    queryFn: async (): Promise<UnitComparisonRow[]> => {
      const supabase = createClient()

      const { data, error } = await supabase.rpc('get_bi_unit_comparison', {
        p_months: months,
      })

      if (error) throw { status: error.code, message: error.message }

      return (data ?? []) as UnitComparisonRow[]
    },
  })
}
