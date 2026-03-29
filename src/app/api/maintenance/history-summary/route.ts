// GET /api/maintenance/history-summary
// Returns KPIs + 12-month trend for completed maintenance orders
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export interface HistorySummaryResponse {
  kpis: {
    total_completed:      number
    avg_resolution_hours: number | null
    total_cost_approved:  number
    avg_cost_per_order:   number | null
  }
  by_month: Array<{ month: string; count: number; cost: number }>
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const unitId     = searchParams.get('unit_id')
    const dateFrom   = searchParams.get('date_from')
    const dateTo     = searchParams.get('date_to')
    const typeParam  = searchParams.get('type')      // comma-separated values
    const sectorId   = searchParams.get('sector_id')
    const supplierId = searchParams.get('supplier_id')

    if (!unitId) return NextResponse.json({ error: 'unit_id é obrigatório.' }, { status: 400 })

    const now = new Date()

    // 12-month buckets for trend chart (always last 12 months regardless of date filter)
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(now, 11 - i)
      return {
        key:   format(d, 'yyyy-MM'),
        label: format(d, 'MMM/yy', { locale: ptBR }),
        from:  startOfMonth(d).toISOString(),
        to:    endOfMonth(d).toISOString(),
      }
    })

    // ── Parallel queries ────────────────────────────────────────
    const [
      completedResult,
      resolutionResult,
      costsResult,
      monthlyOrdersResult,
      monthlyCostsResult,
    ] = await Promise.all([
      // 1. Total completed (with all filters)
      (() => {
        let q = supabase
          .from('maintenance_orders')
          .select('id', { count: 'exact', head: true })
          .eq('unit_id', unitId)
          .eq('status', 'completed')
        if (dateFrom)   q = q.gte('completed_at', dateFrom)
        if (dateTo)     q = q.lte('completed_at', dateTo)
        if (typeParam)  q = q.in('type', typeParam.split(',') as import('@/types/database.types').MaintenanceType[])
        if (sectorId)   q = q.eq('sector_id', sectorId)
        if (supplierId) q = q.eq('supplier_id', supplierId)
        return q
      })(),

      // 2. Resolution time data (with all filters)
      (() => {
        let q = supabase
          .from('maintenance_orders')
          .select('created_at, completed_at')
          .eq('unit_id', unitId)
          .eq('status', 'completed')
        if (dateFrom)   q = q.gte('completed_at', dateFrom)
        if (dateTo)     q = q.lte('completed_at', dateTo)
        if (typeParam)  q = q.in('type', typeParam.split(',') as import('@/types/database.types').MaintenanceType[])
        if (sectorId)   q = q.eq('sector_id', sectorId)
        if (supplierId) q = q.eq('supplier_id', supplierId)
        return q
      })(),

      // 3. Approved costs (with date filter)
      (() => {
        let q = (supabase as unknown as { from: (t: string) => ReturnType<typeof supabase['from']> })
          .from('maintenance_costs')
          .select('amount')
          .eq('unit_id', unitId)
          .eq('status', 'approved')
        if (dateFrom) q = (q as any).gte('submitted_at', dateFrom)
        if (dateTo)   q = (q as any).lte('submitted_at', dateTo)
        return q
      })(),

      // 4. Monthly completed (last 12m, with type/sector/supplier filters)
      (() => {
        let q = supabase
          .from('maintenance_orders')
          .select('completed_at')
          .eq('unit_id', unitId)
          .eq('status', 'completed')
          .gte('completed_at', months[0].from)
          .lte('completed_at', months[11].to)
        if (typeParam)  q = q.in('type', typeParam.split(',') as import('@/types/database.types').MaintenanceType[])
        if (sectorId)   q = q.eq('sector_id', sectorId)
        if (supplierId) q = q.eq('supplier_id', supplierId)
        return q
      })(),

      // 5. Monthly approved costs (last 12m)
      (supabase as any)
        .from('maintenance_costs')
        .select('submitted_at, amount')
        .eq('unit_id', unitId)
        .eq('status', 'approved')
        .gte('submitted_at', months[0].from)
        .lte('submitted_at', months[11].to),
    ])

    // ── KPIs ───────────────────────────────────────────────────
    const total_completed = completedResult.count ?? 0

    // Avg resolution hours
    let avg_resolution_hours: number | null = null
    const durations = (resolutionResult.data ?? [])
      .map((o: { created_at: string | null; completed_at: string | null }) => {
        if (!o.created_at || !o.completed_at) return null
        const h = (new Date(o.completed_at).getTime() - new Date(o.created_at).getTime()) / 3_600_000
        return h >= 0 ? h : null
      })
      .filter((h): h is number => h !== null)

    if (durations.length > 0) {
      avg_resolution_hours = Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
    }

    // Total approved cost
    const total_cost_approved = (costsResult.data ?? []).reduce(
      (sum: number, c: { amount?: number | null }) => sum + Number(c.amount ?? 0),
      0
    )

    const avg_cost_per_order = total_completed > 0
      ? Math.round((total_cost_approved / total_completed) * 100) / 100
      : null

    // ── Monthly trend ──────────────────────────────────────────
    const countBucket: Record<string, number> = {}
    const costBucket:  Record<string, number> = {}
    months.forEach((m) => { countBucket[m.key] = 0; costBucket[m.key] = 0 })

    for (const o of (monthlyOrdersResult.data ?? [])) {
      const at = (o as { completed_at?: string | null }).completed_at
      if (!at) continue
      const key = format(new Date(at), 'yyyy-MM')
      if (key in countBucket) countBucket[key]++
    }

    for (const c of (monthlyCostsResult.data ?? [])) {
      const at = (c as { submitted_at?: string | null }).submitted_at
      if (!at) continue
      const key = format(new Date(at), 'yyyy-MM')
      if (key in costBucket) costBucket[key] += Number((c as { amount?: number | null }).amount ?? 0)
    }

    const by_month = months.map((m) => ({
      month: m.label,
      count: countBucket[m.key],
      cost:  Math.round(costBucket[m.key] * 100) / 100,
    }))

    return NextResponse.json({
      kpis: { total_completed, avg_resolution_hours, total_cost_approved, avg_cost_per_order },
      by_month,
    } satisfies HistorySummaryResponse)
  } catch (err) {
    console.error('[maintenance/history-summary]', err)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
