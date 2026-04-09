// GET /api/maintenance/history-summary
// Returns KPIs + 12-month trend for concluded maintenance tickets
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type TicketNature = 'emergencial' | 'pontual' | 'agendado' | 'preventivo'

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
    const unitId    = searchParams.get('unit_id')
    const dateFrom  = searchParams.get('date_from')
    const dateTo    = searchParams.get('date_to')
    const typeParam = searchParams.get('type')     // comma-separated nature values
    const sectorId  = searchParams.get('sector_id')

    if (!unitId) return NextResponse.json({ error: 'unit_id é obrigatório.' }, { status: 400 })

    const now = new Date()

    // 12-month buckets for trend chart
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = subMonths(now, 11 - i)
      return {
        key:   format(d, 'yyyy-MM'),
        label: format(d, 'MMM/yy', { locale: ptBR }),
        from:  startOfMonth(d).toISOString(),
        to:    endOfMonth(d).toISOString(),
      }
    })

    // ── Pre-fetch ticket IDs for this unit (needed for executions join) ───
    // We build the base ticket filter and reuse it
    const buildTicketQuery = () => {
      let q = supabase
        .from('maintenance_tickets')
        .select('id, created_at, concluded_at')
        .eq('unit_id', unitId)
        .eq('status', 'concluded')
      if (dateFrom)  q = q.gte('concluded_at', dateFrom)
      if (dateTo)    q = q.lte('concluded_at', dateTo)
      if (typeParam) q = q.in('nature', typeParam.split(',') as TicketNature[])
      if (sectorId)  q = q.eq('sector_id', sectorId)
      return q
    }

    const buildTicketIdsQuery = () => {
      let q = supabase
        .from('maintenance_tickets')
        .select('id')
        .eq('unit_id', unitId)
        .eq('status', 'concluded')
      if (dateFrom)  q = q.gte('concluded_at', dateFrom)
      if (dateTo)    q = q.lte('concluded_at', dateTo)
      if (typeParam) q = q.in('nature', typeParam.split(',') as TicketNature[])
      if (sectorId)  q = q.eq('sector_id', sectorId)
      return q
    }

    // Monthly bucket ticket IDs (last 12m, with nature/sector filters, no date range filter)
    const buildMonthlyTicketsQuery = () => {
      let q = supabase
        .from('maintenance_tickets')
        .select('id, concluded_at')
        .eq('unit_id', unitId)
        .eq('status', 'concluded')
        .gte('concluded_at', months[0].from)
        .lte('concluded_at', months[11].to)
      if (typeParam) q = q.in('nature', typeParam.split(',') as TicketNature[])
      if (sectorId)  q = q.eq('sector_id', sectorId)
      return q
    }

    // ── Parallel queries ────────────────────────────────────────
    const [
      resolutionResult,
      filteredTicketIdsResult,
      monthlyTicketsResult,
    ] = await Promise.all([
      // 1. Resolution time data (full ticket data for avg calculation)
      buildTicketQuery(),

      // 2. Filtered ticket IDs (for costs join)
      buildTicketIdsQuery(),

      // 3. Monthly tickets for trend chart
      buildMonthlyTicketsQuery(),
    ])

    const filteredTicketIds = (filteredTicketIdsResult.data ?? []).map((t) => t.id)
    const monthlyTicketData = monthlyTicketsResult.data ?? []

    // Monthly ticket IDs for cost join
    const monthlyTicketIds = monthlyTicketData.map((t) => t.id)

    // ── Costs queries (need ticket IDs) ────────────────────────
    const [costsResult, monthlyCostsResult] = await Promise.all([
      // Approved costs for filtered tickets
      filteredTicketIds.length > 0
        ? supabase
            .from('maintenance_executions')
            .select('cost')
            .in('ticket_id', filteredTicketIds)
            .eq('cost_approved', true)
        : Promise.resolve({ data: [] as { cost: number }[], error: null }),

      // Monthly approved costs (last 12m)
      monthlyTicketIds.length > 0
        ? supabase
            .from('maintenance_executions')
            .select('cost, ticket_id, created_at')
            .in('ticket_id', monthlyTicketIds)
            .eq('cost_approved', true)
        : Promise.resolve({ data: [] as { cost: number; ticket_id: string; created_at: string }[], error: null }),
    ])

    // ── KPIs ───────────────────────────────────────────────────
    const total_completed = filteredTicketIds.length

    // Avg resolution hours
    let avg_resolution_hours: number | null = null
    const durations = (resolutionResult.data ?? [])
      .map((t) => {
        if (!t.created_at || !t.concluded_at) return null
        const h = (new Date(t.concluded_at).getTime() - new Date(t.created_at).getTime()) / 3_600_000
        return h >= 0 ? h : null
      })
      .filter((h): h is number => h !== null)

    if (durations.length > 0) {
      avg_resolution_hours = Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10
    }

    // Total approved cost
    const total_cost_approved = (costsResult.data ?? []).reduce(
      (sum: number, e) => sum + Number((e as { cost?: number | null }).cost ?? 0),
      0
    )

    const avg_cost_per_order = total_completed > 0
      ? Math.round((total_cost_approved / total_completed) * 100) / 100
      : null

    // ── Monthly trend ──────────────────────────────────────────
    const countBucket: Record<string, number> = {}
    const costBucket:  Record<string, number> = {}
    months.forEach((m) => { countBucket[m.key] = 0; costBucket[m.key] = 0 })

    // Build a map from ticket_id → concluded_at for monthly tickets
    const ticketConcludedMap: Record<string, string> = {}
    for (const t of monthlyTicketData) {
      if (t.id && t.concluded_at) ticketConcludedMap[t.id] = t.concluded_at
    }

    // Count by concluded_at month
    for (const t of monthlyTicketData) {
      const at = t.concluded_at
      if (!at) continue
      const key = format(new Date(at), 'yyyy-MM')
      if (key in countBucket) countBucket[key]++
    }

    // Costs bucketed by the ticket's concluded_at month (not execution created_at)
    for (const e of (monthlyCostsResult.data ?? [])) {
      const ex = e as unknown as { cost?: number | null; ticket_id?: string; created_at?: string }
      const ticketAt = ex.ticket_id ? ticketConcludedMap[ex.ticket_id] : null
      const at = ticketAt ?? ex.created_at
      if (!at) continue
      const key = format(new Date(at), 'yyyy-MM')
      if (key in costBucket) costBucket[key] += Number(ex.cost ?? 0)
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
