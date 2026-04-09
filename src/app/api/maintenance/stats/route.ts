// GET /api/maintenance/stats?unit_id=<uuid>
// Returns KPIs + chart data for the maintenance dashboard
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { startOfMonth, endOfMonth, subWeeks, startOfWeek, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export interface MaintenanceStatsResponse {
  kpis: {
    open_count: number
    overdue_count: number
    completed_this_month: number
    avg_resolution_hours: number | null
    emergency_open: number
    total_costs_month: number
    pending_approvals: number
  }
  charts: {
    weekly_completed: Array<{ week: string; count: number }>
    by_type: Array<{ type: string; count: number }>
    by_sector: Array<{ sector: string; count: number }>
  }
}

const TYPE_LABELS: Record<string, string> = {
  emergency: 'Emergencial',
  punctual: 'Pontual',
  recurring: 'Recorrente',
  preventive: 'Preventiva',
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const unitId = searchParams.get('unit_id')
    if (!unitId) {
      return NextResponse.json({ error: 'unit_id é obrigatório.' }, { status: 400 })
    }

    const now = new Date()
    const monthStart = startOfMonth(now).toISOString()
    const monthEnd = endOfMonth(now).toISOString()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // ── Run all queries in parallel ────────────────────────────────
    const [
      openResult,
      overdueResult,
      completedMonthResult,
      avgResolutionResult,
      emergencyResult,
      costsMonthResult,
      pendingCostsResult,
      weeklyResult,
      byTypeResult,
      bySectorResult,
    ] = await Promise.all([
      // 1. Open orders (status != completed)
      supabase
        .from('maintenance_orders')
        .select('id', { count: 'exact', head: true })
        .eq('unit_id', unitId)
        .not('status', 'in', '(completed,cancelled)'),

      // 2. Overdue (open + past due_date)
      supabase
        .from('maintenance_orders')
        .select('id', { count: 'exact', head: true })
        .eq('unit_id', unitId)
        .not('status', 'in', '(completed,cancelled)')
        .lt('due_date', now.toISOString())
        .not('due_date', 'is', null),

      // 3. Completed this month
      supabase
        .from('maintenance_orders')
        .select('id', { count: 'exact', head: true })
        .eq('unit_id', unitId)
        .eq('status', 'completed')
        .gte('updated_at', monthStart)
        .lte('updated_at', monthEnd),

      // 4. Avg resolution hours (last 30 days) - raw select for calculation
      supabase
        .from('maintenance_orders')
        .select('created_at, completed_at, updated_at')
        .eq('unit_id', unitId)
        .eq('status', 'completed')
        .gte('updated_at', thirtyDaysAgo),

      // 5. Emergency open
      supabase
        .from('maintenance_orders')
        .select('id', { count: 'exact', head: true })
        .eq('unit_id', unitId)
        .eq('type', 'emergency')
        .not('status', 'in', '(completed,cancelled)'),

      // 6. Total approved costs this month
      (supabase as any)
        .from('maintenance_costs')
        .select('amount')
        .eq('unit_id', unitId)
        .eq('status', 'approved')
        .gte('submitted_at', monthStart)
        .lte('submitted_at', monthEnd),

      // 7. Pending approvals count
      supabase
        .from('maintenance_costs')
        .select('id', { count: 'exact', head: true })
        .eq('unit_id', unitId)
        .eq('status', 'pending'),

      // 8. Weekly completed (last 4 weeks) - raw for gap fill
      supabase
        .from('maintenance_orders')
        .select('updated_at, completed_at')
        .eq('unit_id', unitId)
        .eq('status', 'completed')
        .gte('updated_at', subWeeks(now, 4).toISOString()),

      // 9. Open orders by type
      supabase
        .from('maintenance_orders')
        .select('type')
        .eq('unit_id', unitId)
        .not('status', 'in', '(completed,cancelled)'),

      // 10. Open orders by sector (with join)
      (supabase as any)
        .from('maintenance_orders')
        .select('sector_id, sector:maintenance_sectors(name)')
        .eq('unit_id', unitId)
        .not('status', 'in', '(completed,cancelled)'),
    ])

    // ── Process avg resolution ─────────────────────────────────────
    let avg_resolution_hours: number | null = null
    if (avgResolutionResult.data && avgResolutionResult.data.length > 0) {
      const durations = avgResolutionResult.data
        .map((o) => {
          const resolved = o.completed_at ?? o.updated_at
          const created = o.created_at
          if (!resolved || !created) return null
          return (new Date(resolved).getTime() - new Date(created).getTime()) / 3_600_000
        })
        .filter((d): d is number => d !== null && d >= 0)

      if (durations.length > 0) {
        avg_resolution_hours = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length * 10) / 10
      }
    }

    // ── Process total costs ────────────────────────────────────────
    const total_costs_month = (costsMonthResult.data ?? []).reduce(
      (sum: number, c: { amount?: number | null }) => sum + Number(c.amount ?? 0),
      0
    )

    // ── Process weekly completed (with gap fill) ───────────────────
    const weekBuckets: Record<string, number> = {}

    // Initialize 4 week buckets (week start dates)
    for (let i = 3; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 })
      const key = format(weekStart, 'dd/MM', { locale: ptBR })
      weekBuckets[key] = 0
    }

    // Fill with actual data
    for (const order of weeklyResult.data ?? []) {
      const resolvedAt = order.completed_at ?? order.updated_at
      if (!resolvedAt) continue
      const d = new Date(resolvedAt)
      const weekStart = startOfWeek(d, { weekStartsOn: 1 })
      // Only count if within our 4-week window
      if (d >= subWeeks(now, 4)) {
        const key = format(weekStart, 'dd/MM', { locale: ptBR })
        if (key in weekBuckets) {
          weekBuckets[key]++
        }
      }
    }

    const weekly_completed = Object.entries(weekBuckets).map(([week, count]) => ({ week, count }))

    // ── Process by_type ────────────────────────────────────────────
    const typeCounts: Record<string, number> = {
      emergency: 0,
      punctual: 0,
      recurring: 0,
      preventive: 0,
    }
    for (const o of byTypeResult.data ?? []) {
      if (o.type && o.type in typeCounts) typeCounts[o.type]++
    }

    const by_type = Object.entries(typeCounts).map(([type, count]) => ({
      type: TYPE_LABELS[type] ?? type,
      count,
    }))

    // ── Process by_sector (top 5) ──────────────────────────────────
    const sectorCounts: Record<string, number> = {}
    for (const o of bySectorResult.data ?? []) {
      const name = (o.sector as { name: string } | null)?.name ?? 'Sem setor'
      sectorCounts[name] = (sectorCounts[name] ?? 0) + 1
    }

    const by_sector = Object.entries(sectorCounts)
      .map(([sector, count]) => ({ sector, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // ── Build response ─────────────────────────────────────────────
    const response: MaintenanceStatsResponse = {
      kpis: {
        open_count: openResult.count ?? 0,
        overdue_count: overdueResult.count ?? 0,
        completed_this_month: completedMonthResult.count ?? 0,
        avg_resolution_hours,
        emergency_open: emergencyResult.count ?? 0,
        total_costs_month,
        pending_approvals: pendingCostsResult.count ?? 0,
      },
      charts: {
        weekly_completed,
        by_type,
        by_sector,
      },
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('[maintenance/stats]', err)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
