import { createClient } from '@supabase/supabase-js'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { sendEmail } from '@/lib/email'
import { tplActionItemAssigned } from '@/lib/email-templates/action-item-assigned'
import { requirePermissionApi } from '@/lib/auth/require-permission'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { formatSaoPauloDateTimeLong } from '@/lib/utils/meeting-datetime'

/**
 * POST /api/minutes/notify-assignment
 * Body: {
 *   meetingMinuteId: string
 *   assignments: { assigneeId: string; description: string; dueDate: string | null }[]
 * }
 *
 * Chamado fire-and-forget pelos hooks de mutação das atas quando uma tarefa
 * (action item) passa a ser atribuída a um usuário — na criação ou edição.
 * O client envia apenas as TRANSIÇÕES de atribuição (item novo com responsável,
 * ou item cujo responsável mudou), já excluindo a auto-atribuição do próprio autor.
 *
 * Endurecimento (defense-in-depth):
 * - O AUTOR é derivado do `auth.uid()` (não do payload) — evita spoofing de remetente.
 * - Cada `assigneeId` é VALIDADO contra `meeting_action_items.assigned_to` da ata —
 *   só notifica quem realmente tem tarefa nela (fecha destinatário arbitrário + vazamento
 *   de título cross-unidade). O client decide quais transições, o servidor confirma a posse.
 *
 * Para cada responsável: cria notificação in-app (RPC create_notification) e,
 * se o usuário tiver e-mail e não tiver desativado nas preferências, envia e-mail.
 * Nunca lança — erros são apenas logados.
 */
export async function POST(request: Request) {
  try {
    const guard = await requirePermissionApi('atas', 'edit')
    if (!guard.ok) return guard.response

    const body = await request.json() as {
      meetingMinuteId?: string
      assignments?:     { assigneeId: string; description: string; dueDate: string | null }[]
    }

    const { meetingMinuteId, assignments } = body

    if (!meetingMinuteId) {
      return Response.json({ error: 'meetingMinuteId required' }, { status: 400 })
    }
    if (!assignments || assignments.length === 0) {
      return Response.json({ ok: true, notified: 0, reason: 'no assignments' })
    }

    // Identidade do AUTOR a partir da sessão (não confiar no payload).
    const ssr = await createServerClient()
    const { data: { user: caller } } = await ssr.auth.getUser()
    if (!caller) {
      return Response.json({ error: 'Não autorizado.' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // 1. Buscar a ata (título + data) — fonte autoritativa
    const { data: minute } = await supabase
      .from('meeting_minutes')
      .select('id, title, meeting_date')
      .eq('id', meetingMinuteId)
      .single()

    if (!minute) {
      return Response.json({ error: 'Ata não encontrada' }, { status: 404 })
    }

    // 2. Conjunto autoritativo de responsáveis válidos = quem realmente tem
    //    action item atribuído nesta ata. Fecha destinatário arbitrário.
    const { data: dbItems } = await supabase
      .from('meeting_action_items')
      .select('assigned_to')
      .eq('meeting_id', meetingMinuteId)
      .not('assigned_to', 'is', null)

    const validAssignees = new Set<string>((dbItems ?? []).map((i) => i.assigned_to as string))

    // 3. Nome do autor (para o e-mail e a notificação)
    const { data: callerRow } = await supabase
      .from('users')
      .select('name')
      .eq('id', caller.id)
      .single()
    const assignerName = callerRow?.name?.trim() || 'Um membro da equipe'

    const meetingDateLabel = formatSaoPauloDateTimeLong(minute.meeting_date)

    // 4. Agrupar as tarefas por responsável — só responsáveis válidos e ≠ autor
    const byAssignee = new Map<string, { description: string; dueLabel: string | null }[]>()
    for (const a of assignments) {
      if (!a?.assigneeId || !a?.description?.trim()) continue
      if (a.assigneeId === caller.id) continue          // self-assignment — não notifica
      if (!validAssignees.has(a.assigneeId)) continue    // destinatário não pertence à ata
      const dueLabel = a.dueDate
        ? format(new Date(`${a.dueDate}T00:00:00`), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
        : null
      const list = byAssignee.get(a.assigneeId) ?? []
      list.push({ description: a.description.trim(), dueLabel })
      byAssignee.set(a.assigneeId, list)
    }

    // 5. Notificar cada responsável (in-app + e-mail)
    let notified = 0

    for (const [assigneeId, tasks] of byAssignee) {
      const isPlural = tasks.length !== 1

      // 5a. Notificação in-app (sino) — sempre
      const { error: rpcErr } = await supabase.rpc('create_notification', {
        p_user_id: assigneeId,
        p_type:    'action_item_assigned',
        p_title:   isPlural ? 'Novas tarefas atribuídas a você' : 'Nova tarefa atribuída a você',
        p_body:    `${assignerName} atribuiu ${isPlural ? `${tasks.length} tarefas` : 'uma tarefa'} a você na ata "${minute.title}".`,
        p_link:    '/atas/minhas-tarefas',
      })
      if (rpcErr) {
        console.error(`[minutes/notify-assignment] Falha na notificação in-app de ${assigneeId}:`, rpcErr)
      }

      // 5b. E-mail — respeitando preferências do usuário
      try {
        const { data: user } = await supabase
          .from('users')
          .select('name, email, preferences')
          .eq('id', assigneeId)
          .single()

        if (!user?.email) { notified++; continue }

        const prefs = user.preferences as { notifications?: { email?: boolean } } | null
        if (prefs?.notifications?.email === false) { notified++; continue }

        const { subject, html } = tplActionItemAssigned({
          assigneeName: user.name ?? 'Olá',
          assignerName,
          meetingTitle: minute.title,
          meetingDate:  meetingDateLabel,
          tasks,
        })
        await sendEmail(user.email, subject, html)
        notified++
      } catch (err) {
        console.error(`[minutes/notify-assignment] Falha ao enviar e-mail para ${assigneeId}:`, err)
      }
    }

    return Response.json({ ok: true, notified })
  } catch (err) {
    console.error('[minutes/notify-assignment]', err)
    return Response.json({ ok: false }, { status: 500 })
  }
}
