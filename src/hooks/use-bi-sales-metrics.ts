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
  /** % change vs previous month (null when no prior data) */
  trendRevenue: number | null
  /** % change vs previous month for avg ticket */
  trendTicket: number | null
  /** % change vs previous month for avg closing days (invertTrend: less = better) */
  trendClosing: number | null
}

// ── Helpers ───────────────────────────────────────────────────

function trendPct(curr: number | null, prev: number | null): number | null {
  if (curr == null || prev == null || prev === 0) return null
  return Math.round(((curr - prev) / prev) * 100)
}

// ── Hook ──────────────────────────────────────────────────────

/**
 * Fetches sales metrics from the BI module.
 * Metrics: revenue, avg ticket, avg closing days, avg booking advance days.
 * Won = status_id=2 (Ganho) OR stage_id=60004787 (Festa Fechada).
 */
export function useBISalesMetrics(months = 7) {
  const { activeUnitId } = useUnitStore()
  const isSessionReady = useAuthReadyStore((s) => s.isSessionReady)

  return useQuery({
    queryKey: ['bi', 'sales-metrics', activeUnitId, months],
    enabled: isSessionReady,
    staleTime: 5 * 60 * 1000,
    retry: (count, err: { status?: number } | null) =>
      count < 3 && err?.status !== 401 && err?.status !== 403,
    queryFn: async (): Promise<BISalesMetricsData> => {
      const supabase = createClient()

      const { data, error } = await supabase.rpc('get_bi_sales_metrics', {
        p_unit_id: activeUnitId ?? null,
        p_months: months,
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

      return {
        rows,
        currentMonth,
        previousMonth,
        sparkRevenue,
        sparkTicket,
        sparkClosing,
        trendRevenue: trendPct(currentMonth?.total_revenue ?? null, previousMonth?.total_revenue ?? null),
        trendTicket:  trendPct(currentMonth?.avg_ticket    ?? null, previousMonth?.avg_ticket    ?? null),
        trendClosing: trendPct(currentMonth?.avg_closing_days ?? null, previousMonth?.avg_closing_days ?? null),
      }
    },
  })
}
