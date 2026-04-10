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
  emergencial: 'Emergencial',
  pontual:     'Pontual',
  agendado:    'Agendado',
  preventivo:  'Preventiva',
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
    const monthStart    = startOfMonth(now).toISOString()
    const monthEnd      = endOfMonth(now).toISOString()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

    // ── Pre-fetch ticket IDs for this unit (needed for executions join) ───
    const { data: unitTickets } = await supabase
      .from('maintenance_tickets')
      .select('id')
      .eq('unit_id', unitId)
    const ticketIds = (unitTickets ?? []).map((t) => t.id)

    // ── Run all queries in parallel ────────────────────────────────
    const [
      openResult,
      overdueResult,
      concludedMonthResult,
      avgResolutionResult,
      emergencyResult,
      costsMonthResult,
      pendingCostsResult,
      weeklyResult,
      byNatureResult,
      bySectorResult,
    ] = await Promise.all([
      // 1. Open tickets (status != concluded/cancelled)
      supabase
        .from('maintenance_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('unit_id', unitId)
        .not('status', 'in', '(concluded,cancelled)'),

      // 2. Overdue (open + past due_at)
      supabase
        .from('maintenance_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('unit_id', unitId)
        .not('status', 'in', '(concluded,cancelled)')
        .lt('due_at', now.toISOString())
        .not('due_at', 'is', null),

      // 3. Concluded this month
      supabase
        .from('maintenance_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('unit_id', unitId)
        .eq('status', 'concluded')
        .gte('concluded_at', monthStart)
        .lte('concluded_at', monthEnd),

      // 4. Avg resolution hours (last 30 days)
      supabase
        .from('maintenance_tickets')
        .select('created_at, concluded_at')
        .eq('unit_id', unitId)
        .eq('status', 'concluded')
        .gte('concluded_at', thirtyDaysAgo),

      // 5. Emergencial open tickets
      supabase
        .from('maintenance_tickets')
        .select('id', { count: 'exact', head: true })
        .eq('unit_id', unitId)
        .eq('nature', 'emergencial')
        .not('status', 'in', '(concluded,cancelled)'),

      // 6. Total approved costs this month (via executions)
      ticketIds.length > 0
        ? supabase
            .from('maintenance_executions')
            .select('cost')
            .in('ticket_id', ticketIds)
            .eq('cost_approved', true)
            .gte('created_at', monthStart)
            .lte('created_at', monthEnd)
        : Promise.resolve({ data: [] as { cost: number }[], error: null }),

      // 7. Pending approvals (unapproved executions with cost > 0)
      ticketIds.length > 0
        ? supabase
            .from('maintenance_executions')
            .select('id', { count: 'exact', head: true })
            .in('ticket_id', ticketIds)
            .eq('cost_approved', false)
            .gt('cost', 0)
        : Promise.resolve({ count: 0, data: null, error: null }),

      // 8. Weekly concluded (last 4 weeks)
      supabase
        .from('maintenance_tickets')
        .select('concluded_at')
        .eq('unit_id', unitId)
        .eq('status', 'concluded')
        .gte('concluded_at', subWeeks(now, 4).toISOString()),

      // 9. Open tickets by nature
      supabase
        .from('maintenance_tickets')
        .select('nature')
        .eq('unit_id', unitId)
        .not('status', 'in', '(concluded,cancelled)'),

      // 10. Open tickets by sector (with join)
      supabase
        .from('maintenance_tickets')
        .select('sector_id, sector:maintenance_sectors!sector_id(name)')
        .eq('unit_id', unitId)
        .not('status', 'in', '(concluded,cancelled)'),
    ])

    // ── Process avg resolution ─────────────────────────────────────
    let avg_resolution_hours: number | null = null
    if (avgResolutionResult.data && avgResolutionResult.data.length > 0) {
      const durations = avgResolutionResult.data
        .map((t) => {
          if (!t.created_at || !t.concluded_at) return null
          return (new Date(t.concluded_at).getTime() - new Date(t.created_at).getTime()) / 3_600_000
        })
        .filter((d): d is number => d !== null && d >= 0)

      if (durations.length > 0) {
        avg_resolution_hours = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length * 10) / 10
      }
    }

    // ── Process total costs ────────────────────────────────────────
    const total_costs_month = (costsMonthResult.data ?? []).reduce(
      (sum: number, e) => sum + Number((e as { cost?: number | null }).cost ?? 0),
      0
    )

    // ── Process weekly concluded (with gap fill) ───────────────────
    const weekBuckets: Record<string, number> = {}

    for (let i = 3; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 })
      const key = format(weekStart, 'dd/MM', { locale: ptBR })
      weekBuckets[key] = 0
    }

    for (const ticket of weeklyResult.data ?? []) {
      const concludedAt = ticket.concluded_at
      if (!concludedAt) continue
      const d = new Date(concludedAt)
      if (d >= subWeeks(now, 4)) {
        const weekStart = startOfWeek(d, { weekStartsOn: 1 })
        const key = format(weekStart, 'dd/MM', { locale: ptBR })
        if (key in weekBuckets) weekBuckets[key]++
      }
    }

    const weekly_completed = Object.entries(weekBuckets).map(([week, count]) => ({ week, count }))

    // ── Process by_nature ──────────────────────────────────────────
    const natureCounts: Record<string, number> = {
      emergencial: 0,
      pontual:     0,
      agendado:    0,
      preventivo:  0,
    }
    for (const t of byNatureResult.data ?? []) {
      if (t.nature && t.nature in natureCounts) natureCounts[t.nature]++
    }

    const by_type = Object.entries(natureCounts).map(([nature, count]) => ({
      type: TYPE_LABELS[nature] ?? nature,
      count,
    }))

    // ── Process by_sector (top 5) ──────────────────────────────────
    const sectorCounts: Record<string, number> = {}
    for (const t of bySectorResult.data ?? []) {
      const sectorRaw = t.sector as unknown
      const name = (sectorRaw as { name: string } | null)?.name ?? 'Sem setor'
      sectorCounts[name] = (sectorCounts[name] ?? 0) + 1
    }

    const by_sector = Object.entries(sectorCounts)
      .map(([sector, count]) => ({ sector, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // ── Build response ─────────────────────────────────────────────
    const response: MaintenanceStatsResponse = {
      kpis: {
        open_count:           openResult.count ?? 0,
        overdue_count:        overdueResult.count ?? 0,
        completed_this_month: concludedMonthResult.count ?? 0,
        avg_resolution_hours,
        emergency_open:       emergencyResult.count ?? 0,
        total_costs_month,
        pending_approvals:    pendingCostsResult.count ?? 0,
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
