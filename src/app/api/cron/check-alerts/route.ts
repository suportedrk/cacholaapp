import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import {
  sendEmail,
  tplEventTomorrow,
  tplChecklistOverdue,
  tplMaintenanceOverdue,
} from '@/lib/email'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * GET /api/cron/check-alerts
 *
 * Endpoint para verificação periódica de alertas automáticos:
 *  1. Eventos de amanhã → notifica equipe escalada + e-mail
 *  2. Checklists atrasados → notifica responsável + e-mail
 *  3. Manutenções atrasadas → notifica responsável + e-mail
 *  4. Manutenções recorrentes próximas → notifica responsável
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
  const tomorrowLabel = format(tomorrow, "d 'de' MMMM", { locale: ptBR })

  let created = 0
  const errors: string[] = []

  // ─────────────────────────────────────────────────────────────
  // HELPER — buscar e-mail do usuário + checar preferência
  // ─────────────────────────────────────────────────────────────
  async function getUserEmail(userId: string): Promise<string | null> {
    const { data } = await supabase
      .from('users')
      .select('email, preferences')
      .eq('id', userId)
      .single()
    if (!data) return null
    const prefs = data.preferences as { notifications?: { email?: boolean } } | null
    if (prefs?.notifications?.email === false) return null
    return data.email
  }

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

        // E-mail
        const email = await getUserEmail(user_id)
        if (email) {
          const { subject, html } = tplEventTomorrow({ eventTitle: event.title, eventId: event.id, eventDate: tomorrowLabel })
          await sendEmail(email, subject, html)
        }
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

      // E-mail
      const email = await getUserEmail(cl.assigned_to)
      if (email) {
        const { subject, html } = tplChecklistOverdue({ checklistTitle: cl.title, checklistId: cl.id })
        await sendEmail(email, subject, html)
      }
    }
  } catch (e) {
    errors.push(`checklist_overdue: ${e}`)
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Chamados de manutenção atrasados → alertar quem abriu
  // ─────────────────────────────────────────────────────────────
  try {
    const { data: overdueTickets, error } = await supabase
      .from('maintenance_tickets')
      .select('id, title, opened_by')
      .lt('due_at', `${todayStr}T00:00:00`)
      .not('status', 'in', '("concluded","cancelled")')
      .not('opened_by', 'is', null)

    if (error) throw error

    for (const ticket of overdueTickets ?? []) {
      if (!ticket.opened_by) continue
      const { error: rpcErr } = await supabase.rpc('create_notification', {
        p_user_id: ticket.opened_by,
        p_type:    'maintenance_overdue',
        p_title:   'Chamado atrasado',
        p_body:    `O chamado "${ticket.title}" está atrasado. Verifique o prazo.`,
        p_link:    `/manutencao/${ticket.id}`,
      })
      if (!rpcErr) created++

      // E-mail
      const email = await getUserEmail(ticket.opened_by)
      if (email) {
        const { subject, html } = tplMaintenanceOverdue({ orderTitle: ticket.title, orderId: ticket.id })
        await sendEmail(email, subject, html)
      }
    }
  } catch (e) {
    errors.push(`maintenance_overdue: ${e}`)
  }

  // Seção 4 (manutenções recorrentes) movida para migration do novo módulo

  // ─────────────────────────────────────────────────────────────
  // 4. Tasks comerciais atrasadas → alertar assignee
  // Dedup: unique index parcial por (user_id, type, link, dia UTC)
  // garante no máximo 1 notificação por task por dia.
  // ─────────────────────────────────────────────────────────────
  try {
    const { data: overdueTasks, error } = await supabase
      .from('commercial_tasks')
      .select('id, title, assignee_id')
      .lt('due_date', `${todayStr}T00:00:00`)
      .not('status', 'in', '("completed","cancelled")')
      .not('assignee_id', 'is', null)

    if (error) throw error

    for (const task of overdueTasks ?? []) {
      const { error: rpcErr } = await supabase.rpc('create_notification', {
        p_user_id: task.assignee_id,
        p_type:    'commercial_task_overdue',
        p_title:   'Tarefa comercial atrasada',
        p_body:    `A tarefa "${task.title}" está atrasada. Confira seu checklist comercial.`,
        p_link:    `/vendas/checklist`,
      })
      if (!rpcErr) created++
    }
  } catch (e) {
    errors.push(`commercial_task_overdue: ${e}`)
  }

  // ─────────────────────────────────────────────────────────────
  // 5. Retenção: remover notificações com mais de 30 dias
  // ─────────────────────────────────────────────────────────────
  let deletedCount = 0
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any).rpc('cleanup_old_notifications', { p_days: 30 })
    deletedCount = (data as number) ?? 0
  } catch (e) {
    errors.push(`cleanup_notifications: ${e}`)
  }

  return Response.json({
    ok:           errors.length === 0,
    created,
    deleted:      deletedCount,
    errors:       errors.length > 0 ? errors : undefined,
    date:         todayStr,
  })
}
