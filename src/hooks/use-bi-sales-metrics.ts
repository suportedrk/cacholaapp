'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { useUnitStore } from '@/stores/unit-store'
import { useAuthReadyStore } from '@/stores/auth-store'
import type { SparkPoint } from '@/hooks/use-dashboard'

// ── Types ─────────────────────────────────────────────────────

export type SalesMetricsDataPoint = {
  month: string                        // 'YYYY-MM'
  won_deals: number
  total_revenue: number
  avg_ticket: number | null
  avg_closing_days: number | null
  avg_booking_advance_days: number | null
}

export type BISalesMetricsData = {
  /** Rows ordered oldest → newest */
  rows: SalesMetricsDataPoint[]
  /** Current month row (null if no data) */
  currentMonth: SalesMetricsDataPoint | null
  /** Previous month row (null if no data) */
  previousMonth: SalesMetricsDataPoint | null
  /** Sparklines oldest → newest */
  sparkRevenue: SparkPoint[]
  sparkTicket: SparkPoint[]
  sparkClosing: SparkPoint[]
  /** Aggregated prev-period revenue (null when no prev dates supplied or 'Tudo' selected) */
  prevRevenue: number | null
  /** Aggregated prev-period won deals */
  prevWonDeals: number | null
  /** Aggregated prev-period avg ticket */
  prevAvgTicket: number | null
  /** Aggregated prev-period avg closing days */
  prevAvgClosing: number | null
  /** Aggregated prev-period avg booking advance days */
  prevAvgAdvance: number | null
}

// ── Hook ──────────────────────────────────────────────────────

/**
 * Fetches sales metrics from the BI module.
 * Metrics: revenue, avg ticket, avg closing days, avg booking advance days.
 * Won = status_id=2 (Ganho) OR stage_id=60004787 (Festa Fechada).
 * Pass unitIdOverride to query a specific unit (e.g. in per-unit breakdown).
 * Pass prevStart/prevEnd (ISO "YYYY-MM-DD") to receive prev_* period aggregates.
 */
export function useBISalesMetrics(
  months = 7,
  unitIdOverride?: string | null,
  prevStart?: string | null,
  prevEnd?: string | null,
) {
  const { activeUnitId: storeUnitId } = useUnitStore()
  const activeUnitId = unitIdOverride !== undefined ? unitIdOverride : storeUnitId
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['bi', 'sales-metrics', activeUnitId, months, prevStart, prevEnd],
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry: (count, err: { status?: number } | null) =>
      count < 3 && err?.status !== 401 && err?.status !== 403,
    queryFn: async (): Promise<BISalesMetricsData> => {
      const supabase = createClient()

      const { data, error } = await supabase.rpc('get_bi_sales_metrics', {
        p_unit_id:    activeUnitId ?? null,
        p_months:     months,
        p_prev_start: prevStart ?? null,
        p_prev_end:   prevEnd   ?? null,
      })

      if (error) throw { status: error.code, message: error.message }

      // RPC returns DESC (newest first) — reverse for oldest → newest
      const rows: SalesMetricsDataPoint[] = ((data ?? []) as SalesMetricsDataPoint[])
        .slice()
        .reverse()

      const currentMonth  = rows[rows.length - 1] ?? null
      const previousMonth = rows[rows.length - 2] ?? null

      const sparkRevenue: SparkPoint[] = rows.map((r) => ({ v: r.total_revenue }))
      const sparkTicket:  SparkPoint[] = rows.map((r) => ({ v: r.avg_ticket  ?? 0 }))
      const sparkClosing: SparkPoint[] = rows.map((r) => ({ v: r.avg_closing_days ?? 0 }))

      // prev_* are scalar values repeated in every row — extract from first row with data
      const anyRow = (data as (SalesMetricsDataPoint & {
        prev_revenue: number | null
        prev_won_deals: number | null
        prev_avg_ticket: number | null
        prev_avg_closing_days: number | null
        prev_avg_advance_days: number | null
      })[] | null)?.[0] ?? null

      return {
        rows,
        currentMonth,
        previousMonth,
        sparkRevenue,
        sparkTicket,
        sparkClosing,
        prevRevenue:    anyRow?.prev_revenue          ?? null,
        prevWonDeals:   anyRow?.prev_won_deals        ?? null,
        prevAvgTicket:  anyRow?.prev_avg_ticket       ?? null,
        prevAvgClosing: anyRow?.prev_avg_closing_days ?? null,
        prevAvgAdvance: anyRow?.prev_avg_advance_days ?? null,
      }
    },
  })
}
