'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import type { SparkPoint } from '@/hooks/use-dashboard'

// ── Types ─────────────────────────────────────────────────────

export type BIConversionRow = {
  month: string            // 'YYYY-MM'
  total_leads: number
  won_leads: number
  conversion_rate: number | null
}

export type BIConversionData = {
  /** Rows ordered oldest → newest (for table display) */
  rows: BIConversionRow[]
  /** Current month conversion rate (null if no data) */
  currentRate: number | null
  /** Trend in percentage points vs previous month (null if no prior data) */
  trend: number | null
  /** Sparkline oldest → newest */
  spark: SparkPoint[]
}

// ── Hook ──────────────────────────────────────────────────────

/**
 * Fetches conversion rate data from the BI module.
 * Uses ploomes_deals.ploomes_create_date (real CRM creation date).
 * Won = status_id=2 (Ganho) OR stage_id=60004787 (Festa Fechada).
 */
export function useBIConversionData(months = 7) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['bi', 'conversion', activeUnitId, months],
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry: (count, err: { status?: number } | null) =>
      count < 3 && err?.status !== 401 && err?.status !== 403,
    queryFn: async (): Promise<BIConversionData> => {
      const supabase = createClient()

      const { data, error } = await supabase.rpc('get_bi_conversion_data', {
        p_unit_id: activeUnitId ?? null,
        p_months: months,
      })

      if (error) throw { status: error.code, message: error.message }

      // RPC returns DESC (newest first) — reverse for oldest→newest
      const rows: BIConversionRow[] = ((data ?? []) as BIConversionRow[])
        .slice()
        .reverse()

      // Current month = last in the reversed array
      const currentRow = rows[rows.length - 1] ?? null
      const prevRow    = rows[rows.length - 2] ?? null

      const currentRate = currentRow?.conversion_rate ?? null

      // Trend in percentage points (pp), displayed as % by KpiCard
      let trend: number | null = null
      if (currentRate != null && prevRow?.conversion_rate != null) {
        trend = Math.round((currentRate - prevRow.conversion_rate) * 10) / 10
      }

      const spark: SparkPoint[] = rows.map((r) => ({
        v: r.conversion_rate ?? 0,
      }))

      return { rows, currentRate, trend, spark }
    },
  })
}
