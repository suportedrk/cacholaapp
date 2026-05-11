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
  /** Trend in percentage points vs previous month (null if no prior data).
   *  Kept for Excel export (`export-bi-report.ts` line 69). */
  trend: number | null
  /** Sparkline oldest → newest */
  spark: SparkPoint[]
  /** Aggregated prev-period total leads (null when no prev dates supplied or 'Tudo' selected) */
  prevTotalLeads: number | null
  /** Aggregated prev-period won leads */
  prevWonLeads: number | null
  /** Aggregated prev-period conversion rate */
  prevConvRate: number | null
}

// ── Hook ──────────────────────────────────────────────────────

/**
 * Fetches conversion rate data from the BI module.
 * Uses ploomes_deals.ploomes_create_date (real CRM creation date).
 * Won = status_id=2 (Ganho) OR stage_id=60004787 (Festa Fechada).
 * Pass unitIdOverride to query a specific unit (e.g. in per-unit breakdown).
 * Pass prevStart/prevEnd (ISO "YYYY-MM-DD") to receive prev_* period aggregates.
 */
export function useBIConversionData(
  months = 7,
  unitIdOverride?: string | null,
  prevStart?: string | null,
  prevEnd?: string | null,
) {
  const { activeUnitId: storeUnitId } = useUnitStore()
  const activeUnitId = unitIdOverride !== undefined ? unitIdOverride : storeUnitId
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['bi', 'conversion', activeUnitId, months, prevStart, prevEnd],
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry: (count, err: { status?: number } | null) =>
      count < 3 && err?.status !== 401 && err?.status !== 403,
    queryFn: async (): Promise<BIConversionData> => {
      const supabase = createClient()

      const { data, error } = await supabase.rpc('get_bi_conversion_data', {
        p_unit_id:    activeUnitId ?? null,
        p_months:     months,
        p_prev_start: prevStart ?? null,
        p_prev_end:   prevEnd   ?? null,
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

      // Trend in percentage points (pp), displayed as % by KpiCard.
      // Kept for Excel export — see export-bi-report.ts.
      let trend: number | null = null
      if (currentRate != null && prevRow?.conversion_rate != null) {
        trend = Math.round((currentRate - prevRow.conversion_rate) * 10) / 10
      }

      const spark: SparkPoint[] = rows.map((r) => ({
        v: r.conversion_rate ?? 0,
      }))

      // prev_* are scalar values repeated in every row — extract from first row with data
      const anyRow = (data as (BIConversionRow & {
        prev_total_leads: number | null
        prev_won_leads: number | null
        prev_conversion_rate: number | null
      })[] | null)?.[0] ?? null

      return {
        rows,
        currentRate,
        trend,
        spark,
        prevTotalLeads: anyRow?.prev_total_leads      ?? null,
        prevWonLeads:   anyRow?.prev_won_leads        ?? null,
        prevConvRate:   anyRow?.prev_conversion_rate  ?? null,
      }
    },
  })
}
