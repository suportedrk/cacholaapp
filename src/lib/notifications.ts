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

// ─────────────────────────────────────────────────────────────
// MANUTENÇÃO CRIADA → notifica responsável
// ─────────────────────────────────────────────────────────────
export async function notifyMaintenanceCreated(
  supabase: SupabaseClient,
  orderId: string,
  actorUserId?: string
): Promise<void> {
  const { data: order } = await (supabase as any)
    .from('maintenance_orders')
    .select('title, assigned_to')
    .eq('id', orderId)
    .single()

  if (!order?.assigned_to || order.assigned_to === actorUserId) return

  await insert(supabase, order.assigned_to, 'maintenance_created',
    'Nova ordem de manutenção',
    `Você foi designado para: "${order.title}"`,
    `/manutencao/${orderId}`
  )
}

// ─────────────────────────────────────────────────────────────
// MANUTENÇÃO EMERGENCIAL → notifica responsável + gerentes
// ─────────────────────────────────────────────────────────────
export async function notifyMaintenanceEmergency(
  supabase: SupabaseClient,
  orderId: string,
  actorUserId?: string
): Promise<void> {
  const { data: order } = await (supabase as any)
    .from('maintenance_orders')
    .select('title, assigned_to')
    .eq('id', orderId)
    .single()

  if (!order) return

  // Buscar gerentes e diretores
  const { data: managers } = await (supabase as any)
    .from('users')
    .select('id')
    .in('role', ['super_admin', 'diretor', 'gerente'])
    .eq('is_active', true)

  const recipients = new Set<string>(
    (managers ?? []).map((u: { id: string }) => u.id)
  )
  if (order.assigned_to) recipients.add(order.assigned_to)
  recipients.delete(actorUserId ?? '')

  await Promise.all(
    Array.from(recipients).map((uid) =>
      insert(supabase, uid, 'maintenance_emergency',
        '🔴 Manutenção Emergencial',
        `"${order.title}" requer atenção imediata!`,
        `/manutencao/${orderId}`
      )
    )
  )
}

// ─────────────────────────────────────────────────────────────
// STATUS DA MANUTENÇÃO MUDOU → notifica criador + responsável
// ─────────────────────────────────────────────────────────────
const MAINTENANCE_STATUS_LABEL: Record<string, string> = {
  open:          'Aberta',
  in_progress:   'Em Andamento',
  waiting_parts: 'Aguardando Peças',
  completed:     'Concluída',
  cancelled:     'Cancelada',
}

export async function notifyMaintenanceStatusChanged(
  supabase: SupabaseClient,
  orderId: string,
  newStatus: string,
  actorUserId?: string
): Promise<void> {
  const { data: order } = await (supabase as any)
    .from('maintenance_orders')
    .select('title, created_by, assigned_to')
    .eq('id', orderId)
    .single()

  if (!order) return

  const label = MAINTENANCE_STATUS_LABEL[newStatus] ?? newStatus
  const recipients = new Set<string>([order.created_by, order.assigned_to].filter(Boolean))
  recipients.delete(actorUserId ?? '')

  await Promise.all(
    Array.from(recipients).map((uid) =>
      insert(supabase, uid, 'maintenance_status',
        'Status de manutenção atualizado',
        `"${order.title}" agora está como ${label}`,
        `/manutencao/${orderId}`
      )
    )
  )
}

// ─────────────────────────────────────────────────────────────
// MANUTENÇÃO CONCLUÍDA → notifica criador
// ─────────────────────────────────────────────────────────────
export async function notifyMaintenanceCompleted(
  supabase: SupabaseClient,
  orderId: string,
  creatorUserId: string,
  actorUserId?: string
): Promise<void> {
  if (creatorUserId === actorUserId) return

  const { data: order } = await (supabase as any)
    .from('maintenance_orders')
    .select('title')
    .eq('id', orderId)
    .single()

  if (!order) return

  await insert(supabase, creatorUserId, 'maintenance_completed',
    'Manutenção concluída',
    `A ordem "${order.title}" foi concluída`,
    `/manutencao/${orderId}`
  )
}

// CUSTO SUBMETIDO → notifica gerentes da unidade
// ─────────────────────────────────────────────────────────────
export async function notifyCostSubmitted(
  supabase: SupabaseClient,
  orderId: string,
  costDescription: string,
  unitId: string,
  submittedByUserId: string
): Promise<void> {
  const { data: managers } = await (supabase as any)
    .from('user_units')
    .select('user_id')
    .eq('unit_id', unitId)
    .in('role', ['gerente', 'diretor', 'super_admin'])

  if (!managers?.length) return

  for (const m of managers) {
    if (m.user_id === submittedByUserId) continue
    await insert(supabase, m.user_id, 'cost_submitted',
      'Novo custo para aprovação',
      `"${costDescription}" aguarda sua aprovação`,
      `/manutencao/${orderId}`
    )
  }
}

// CUSTO APROVADO → notifica técnico que submeteu
// ─────────────────────────────────────────────────────────────
export async function notifyCostApproved(
  supabase: SupabaseClient,
  orderId: string,
  costDescription: string,
  submittedByUserId: string,
  reviewerUserId: string
): Promise<void> {
  if (submittedByUserId === reviewerUserId) return

  await insert(supabase, submittedByUserId, 'cost_approved',
    'Custo aprovado',
    `"${costDescription}" foi aprovado`,
    `/manutencao/${orderId}`
  )
}

// CUSTO REJEITADO → notifica técnico que submeteu (com motivo)
// ─────────────────────────────────────────────────────────────
export async function notifyCostRejected(
  supabase: SupabaseClient,
  orderId: string,
  costDescription: string,
  submittedByUserId: string,
  reviewerUserId: string,
  reviewNotes?: string
): Promise<void> {
  if (submittedByUserId === reviewerUserId) return

  const body = reviewNotes
    ? `"${costDescription}" foi reprovado: ${reviewNotes}`
    : `"${costDescription}" foi reprovado`

  await insert(supabase, submittedByUserId, 'cost_rejected',
    'Custo reprovado',
    body,
    `/manutencao/${orderId}`
  )
}

// ─────────────────────────────────────────────────────────────
// CHECKLISTS PREMIUM (Migration 018)
// ─────────────────────────────────────────────────────────────

// Item de checklist atribuído a um responsável
export async function notifyChecklistItemAssigned(
  supabase: SupabaseClient,
  itemId: string,
  assignedToUserId: string,
  actorUserId?: string
): Promise<void> {
  if (assignedToUserId === actorUserId) return

  const { data: item } = await (supabase as any)
    .from('checklist_items')
    .select('description, checklist_id, checklist:checklists(title)')
    .eq('id', itemId)
    .single()

  if (!item) return

  await insert(
    supabase,
    assignedToUserId,
    'checklist_item_assigned',
    'Tarefa atribuída a você',
    `"${item.description}" no checklist "${item.checklist?.title ?? ''}"`,
    `/checklists/${item.checklist_id}`
  )
}

// Novo comentário em item do qual o usuário é responsável
export async function notifyChecklistItemCommented(
  supabase: SupabaseClient,
  itemId: string,
  actorUserId: string
): Promise<void> {
  const { data: item } = await (supabase as any)
    .from('checklist_items')
    .select('description, assigned_to, checklist_id, checklist:checklists(title)')
    .eq('id', itemId)
    .single()

  if (!item || !item.assigned_to) return
  if (item.assigned_to === actorUserId) return

  await insert(
    supabase,
    item.assigned_to,
    'checklist_item_commented',
    'Novo comentário na sua tarefa',
    `Comentário em "${item.description}"`,
    `/checklists/${item.checklist_id}`
  )
}

// Item de checklist passou do prazo → notifica responsável
export async function notifyChecklistItemOverdue(
  supabase: SupabaseClient,
  itemId: string
): Promise<void> {
  const { data: item } = await (supabase as any)
    .from('checklist_items')
    .select('description, assigned_to, checklist_id, checklist:checklists(title, unit_id)')
    .eq('id', itemId)
    .single()

  if (!item || !item.assigned_to) return

  await insert(
    supabase,
    item.assigned_to,
    'checklist_item_overdue',
    'Tarefa em atraso',
    `"${item.description}" passou do prazo`,
    `/checklists/${item.checklist_id}`
  )
}

// Checklist recorrente gerado automaticamente → notifica responsável
export async function notifyChecklistRecurringGenerated(
  supabase: SupabaseClient,
  checklistId: string
): Promise<void> {
  const { data: cl } = await (supabase as any)
    .from('checklists')
    .select('title, assigned_to')
    .eq('id', checklistId)
    .single()

  if (!cl || !cl.assigned_to) return

  await insert(
    supabase,
    cl.assigned_to,
    'checklist_recurring_generated',
    'Checklist recorrente gerado',
    `O checklist "${cl.title}" foi gerado automaticamente`,
    `/checklists/${checklistId}`
  )
}

// Checklist duplicado de evento anterior → notifica responsável
export async function notifyChecklistDuplicated(
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

  await insert(
    supabase,
    cl.assigned_to,
    'checklist_duplicated',
    'Checklist duplicado atribuído',
    `O checklist "${cl.title}" foi criado a partir de um evento anterior`,
    `/checklists/${checklistId}`
  )
}

// ─────────────────────────────────────────────────────────────
// PRESTADORES DE SERVIÇOS (Migration 021)
// ─────────────────────────────────────────────────────────────

// Prestador adicionado ao evento → notifica gerentes da unidade
export async function notifyProviderAddedToEvent(
  supabase: SupabaseClient,
  eventProviderId: string,
  actorUserId?: string
): Promise<void> {
  const { data: ep } = await (supabase as any)
    .from('event_providers')
    .select('unit_id, event_id, provider:service_providers(name), event:events(id, title)')
    .eq('id', eventProviderId)
    .single()

  if (!ep) return

  const { data: managers } = await (supabase as any)
    .from('user_units')
    .select('user_id')
    .eq('unit_id', ep.unit_id)
    .in('role', ['gerente', 'diretor', 'super_admin'])

  if (!managers?.length) return

  for (const m of managers) {
    if (m.user_id === actorUserId) continue
    await insert(
      supabase,
      m.user_id,
      'provider_added_to_event',
      'Prestador adicionado ao evento',
      `${ep.provider?.name} foi adicionado à festa "${ep.event?.title}"`,
      `/eventos/${ep.event_id}`
    )
  }
}

// Status do prestador no evento mudou → notifica gerentes
export async function notifyProviderStatusChanged(
  supabase: SupabaseClient,
  eventProviderId: string,
  newStatus: string,
  actorUserId?: string
): Promise<void> {
  const STATUS_LABELS: Record<string, string> = {
    pending:   'pendente',
    confirmed: 'confirmado',
    cancelled: 'cancelado',
    completed: 'concluído',
  }

  const { data: ep } = await (supabase as any)
    .from('event_providers')
    .select('unit_id, event_id, provider:service_providers(name), event:events(id, title)')
    .eq('id', eventProviderId)
    .single()

  if (!ep) return

  const { data: managers } = await (supabase as any)
    .from('user_units')
    .select('user_id')
    .eq('unit_id', ep.unit_id)
    .in('role', ['gerente', 'diretor', 'super_admin'])

  const label = STATUS_LABELS[newStatus] ?? newStatus
  const recipients = new Set<string>((managers ?? []).map((m: { user_id: string }) => m.user_id))
  recipients.delete(actorUserId ?? '')

  for (const uid of Array.from(recipients)) {
    await insert(
      supabase,
      uid,
      'provider_status_changed',
      'Status do prestador atualizado',
      `${ep.provider?.name} foi ${label} para "${ep.event?.title}"`,
      `/eventos/${ep.event_id}`
    )
  }
}

// Documento de prestador vence em ≤30 dias → notifica manager (cron)
export async function notifyProviderDocExpiring(
  supabase: SupabaseClient,
  userId: string,
  providerName: string,
  docName: string,
  daysLeft: number,
  providerId: string
): Promise<void> {
  await insert(
    supabase,
    userId,
    'provider_doc_expiring',
    'Documento vencendo',
    `"${docName}" de ${providerName} vence em ${daysLeft} dia${daysLeft === 1 ? '' : 's'}`,
    `/prestadores/${providerId}`
  )
}

// Documento de prestador já venceu → notifica manager (cron)
export async function notifyProviderDocExpired(
  supabase: SupabaseClient,
  userId: string,
  providerName: string,
  docName: string,
  providerId: string
): Promise<void> {
  await insert(
    supabase,
    userId,
    'provider_doc_expired',
    'Documento vencido',
    `"${docName}" de ${providerName} está vencido`,
    `/prestadores/${providerId}`
  )
}

// Avaliação pendente para prestador → notifica manager (cron)
export async function notifyProviderRatingPending(
  supabase: SupabaseClient,
  userId: string,
  providerName: string,
  eventTitle: string,
  eventId: string
): Promise<void> {
  await insert(
    supabase,
    userId,
    'provider_rating_pending',
    `Avalie ${providerName}`,
    `Como foi ${providerName} na festa "${eventTitle}"?`,
    `/eventos/${eventId}`
  )
}
