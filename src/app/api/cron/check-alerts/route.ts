import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

/**
 * GET /api/cron/check-alerts
 *
 * Endpoint para verificação periódica de alertas automáticos:
 *  1. Eventos de amanhã → notifica equipe escalada
 *  2. Checklists atrasados → notifica responsável
 *
 * Protegido por CRON_SECRET no header Authorization.
 * Chamar via: `Authorization: Bearer <CRON_SECRET>`
 */
export async function GET(request: Request) {
  // ── Verificação de segurança ──
  const authHeader = request.headers.get('authorization')
  const expectedToken = process.env.CRON_SECRET

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Cliente admin (bypassa RLS) ──
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const todayStr    = today.toISOString().split('T')[0]
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  let created = 0
  const errors: string[] = []

  // ─────────────────────────────────────────────────────────────
  // 1. Eventos de amanhã → alertar equipe
  // ─────────────────────────────────────────────────────────────
  try {
    const { data: events, error } = await supabase
      .from('events')
      .select('id, title, event_staff(user_id)')
      .eq('date', tomorrowStr)
      .not('status', 'in', '("finished","post_event","cancelled")')

    if (error) throw error

    for (const event of events ?? []) {
      const staff = event.event_staff as unknown as { user_id: string }[]
      for (const { user_id } of staff) {
        const { error: rpcErr } = await supabase.rpc('create_notification', {
          p_user_id: user_id,
          p_type:    'event_tomorrow',
          p_title:   'Evento amanhã',
          p_body:    `"${event.title}" acontece amanhã. Confira os detalhes.`,
          p_link:    `/eventos/${event.id}`,
        })
        if (!rpcErr) created++
      }
    }
  } catch (e) {
    errors.push(`event_tomorrow: ${e}`)
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Checklists atrasados → alertar responsável
  // ─────────────────────────────────────────────────────────────
  try {
    const { data: checklists, error } = await supabase
      .from('checklists')
      .select('id, title, assigned_to')
      .lt('due_date', `${todayStr}T00:00:00`)
      .not('status', 'in', '("completed","cancelled")')
      .not('assigned_to', 'is', null)

    if (error) throw error

    for (const cl of checklists ?? []) {
      if (!cl.assigned_to) continue
      const { error: rpcErr } = await supabase.rpc('create_notification', {
        p_user_id: cl.assigned_to,
        p_type:    'checklist_overdue',
        p_title:   'Checklist atrasado',
        p_body:    `O checklist "${cl.title}" está atrasado. Finalize o quanto antes.`,
        p_link:    `/checklists/${cl.id}`,
      })
      if (!rpcErr) created++
    }
  } catch (e) {
    errors.push(`checklist_overdue: ${e}`)
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Manutenções atrasadas → alertar responsável
  // ─────────────────────────────────────────────────────────────
  try {
    const { data: overdueOrders, error } = await supabase
      .from('maintenance_orders')
      .select('id, title, assigned_to')
      .lt('due_date', `${todayStr}T00:00:00`)
      .not('status', 'in', '("completed","cancelled")')
      .not('assigned_to', 'is', null)

    if (error) throw error

    for (const order of overdueOrders ?? []) {
      if (!order.assigned_to) continue
      const { error: rpcErr } = await supabase.rpc('create_notification', {
        p_user_id: order.assigned_to,
        p_type:    'maintenance_overdue',
        p_title:   'Manutenção atrasada',
        p_body:    `A ordem "${order.title}" está atrasada. Resolva o quanto antes.`,
        p_link:    `/manutencao/${order.id}`,
      })
      if (!rpcErr) created++
    }
  } catch (e) {
    errors.push(`maintenance_overdue: ${e}`)
  }

  // ─────────────────────────────────────────────────────────────
  // 4. Manutenções recorrentes próximas do vencimento
  // ─────────────────────────────────────────────────────────────
  try {
    const { data: recurringOrders, error } = await supabase
      .from('maintenance_orders')
      .select('id, title, assigned_to, recurrence_rule')
      .eq('type', 'recurring')
      .eq('status', 'open')
      .not('assigned_to', 'is', null)

    if (error) throw error

    for (const order of recurringOrders ?? []) {
      if (!order.assigned_to || !order.recurrence_rule) continue
      const rule = order.recurrence_rule as { next_due_date?: string; advance_notice_days?: number }
      if (!rule.next_due_date) continue

      const advanceDays = rule.advance_notice_days ?? 1
      const notifyDate = new Date(rule.next_due_date)
      notifyDate.setDate(notifyDate.getDate() - advanceDays)

      if (notifyDate.toISOString().split('T')[0] === todayStr) {
        const { error: rpcErr } = await supabase.rpc('create_notification', {
          p_user_id: order.assigned_to,
          p_type:    'maintenance_due_soon',
          p_title:   'Manutenção próxima do vencimento',
          p_body:    `"${order.title}" vence em ${advanceDays} dia(s). Planeje-se.`,
          p_link:    `/manutencao/${order.id}`,
        })
        if (!rpcErr) created++
      }
    }
  } catch (e) {
    errors.push(`maintenance_due_soon: ${e}`)
  }

  return Response.json({
    ok:      errors.length === 0,
    created,
    errors:  errors.length > 0 ? errors : undefined,
    date:    todayStr,
  })
}
