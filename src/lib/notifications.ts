/**
 * Funções utilitárias para criação de notificações.
 * Usa `supabase.rpc('create_notification')` (SECURITY DEFINER) para
 * inserir notificações para qualquer usuário sem restrição de RLS.
 *
 * Uso: Importar nos hooks de mutation (client-side) ou em route handlers (server-side).
 * O chamador passa o supabase client já instanciado.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// HELPER INTERNO
// ─────────────────────────────────────────────────────────────
async function insert(
  supabase: SupabaseClient,
  userId: string,
  type: string,
  title: string,
  body: string,
  link?: string
): Promise<void> {
  await (supabase as any).rpc('create_notification', {
    p_user_id: userId,
    p_type:    type,
    p_title:   title,
    p_body:    body,
    p_link:    link ?? null,
  })
}

// ─────────────────────────────────────────────────────────────
// EVENTO CRIADO → notifica equipe escalada
// ─────────────────────────────────────────────────────────────
export async function notifyEventCreated(
  supabase: SupabaseClient,
  eventId: string,
  actorUserId?: string
): Promise<void> {
  const { data: event } = await (supabase as any)
    .from('events')
    .select('title, event_staff(user_id)')
    .eq('id', eventId)
    .single()

  if (!event) return

  const recipients: string[] = (event.event_staff as { user_id: string }[])
    .map((s) => s.user_id)
    .filter((uid) => uid !== actorUserId)

  await Promise.all(
    recipients.map((uid) =>
      insert(supabase, uid, 'event_created',
        'Novo evento',
        `Você foi escalado para "${event.title}"`,
        `/eventos/${eventId}`
      )
    )
  )
}

// ─────────────────────────────────────────────────────────────
// STATUS DO EVENTO MUDOU → notifica equipe escalada
// ─────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  draft:       'Rascunho',
  confirmed:   'Confirmado',
  in_progress: 'Em Andamento',
  finished:    'Finalizado',
  post_event:  'Pós-Evento',
  cancelled:   'Cancelado',
}

export async function notifyStatusChanged(
  supabase: SupabaseClient,
  eventId: string,
  newStatus: string,
  actorUserId?: string
): Promise<void> {
  const { data: event } = await (supabase as any)
    .from('events')
    .select('title, event_staff(user_id)')
    .eq('id', eventId)
    .single()

  if (!event) return

  const label = STATUS_LABEL[newStatus] ?? newStatus

  const recipients: string[] = (event.event_staff as { user_id: string }[])
    .map((s) => s.user_id)
    .filter((uid) => uid !== actorUserId)

  await Promise.all(
    recipients.map((uid) =>
      insert(supabase, uid, 'event_status',
        'Status do evento atualizado',
        `"${event.title}" agora está como ${label}`,
        `/eventos/${eventId}`
      )
    )
  )
}

// ─────────────────────────────────────────────────────────────
// CHECKLIST ATRIBUÍDO → notifica o responsável
// ─────────────────────────────────────────────────────────────
export async function notifyChecklistAssigned(
  supabase: SupabaseClient,
  checklistId: string,
  actorUserId?: string
): Promise<void> {
  const { data: cl } = await (supabase as any)
    .from('checklists')
    .select('title, assigned_to')
    .eq('id', checklistId)
    .single()

  if (!cl || !cl.assigned_to) return
  if (cl.assigned_to === actorUserId) return

  await insert(supabase, cl.assigned_to, 'checklist_assigned',
    'Checklist atribuído',
    `Você é responsável pelo checklist "${cl.title}"`,
    `/checklists/${checklistId}`
  )
}

// ─────────────────────────────────────────────────────────────
// CHECKLIST CONCLUÍDO → notifica equipe do evento (se vinculado)
// ─────────────────────────────────────────────────────────────
export async function notifyChecklistCompleted(
  supabase: SupabaseClient,
  checklistId: string,
  actorUserId?: string
): Promise<void> {
  const { data: cl } = await (supabase as any)
    .from('checklists')
    .select(`
      title,
      event_id,
      event:events(title, event_staff(user_id))
    `)
    .eq('id', checklistId)
    .single()

  if (!cl) return

  const recipients: string[] = cl.event
    ? (cl.event.event_staff as { user_id: string }[])
        .map((s: { user_id: string }) => s.user_id)
        .filter((uid: string) => uid !== actorUserId)
    : []

  await Promise.all(
    recipients.map((uid) =>
      insert(supabase, uid, 'checklist_completed',
        'Checklist concluído',
        `"${cl.title}" foi finalizado`,
        `/checklists/${checklistId}`
      )
    )
  )
}
