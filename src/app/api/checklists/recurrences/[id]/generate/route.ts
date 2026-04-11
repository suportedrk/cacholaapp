import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

/**
 * POST /api/checklists/recurrences/[id]/generate
 *
 * Geração forçada: cria um checklist agora a partir de uma regra de
 * recorrência, independentemente do next_generation_at agendado.
 *
 * Diferenças em relação ao cron:
 *  - Autenticado por sessão do usuário (cookies), não por CRON_SECRET
 *  - Não altera next_generation_at (não interfere no agendamento)
 *  - Atualiza apenas last_generated_at
 *  - Retorna { checklist_id, title }
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  // ── Verificar sessão ──
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  // ── Buscar regra de recorrência (RLS garante acesso por unidade) ──
  const { data: rec, error: recErr } = await supabase
    .from('checklist_recurrence')
    .select('*')
    .eq('id', id)
    .single()

  if (recErr || !rec) {
    return Response.json({ error: 'Regra não encontrada' }, { status: 404 })
  }

  if (!rec.is_active) {
    return Response.json({ error: 'Regra de recorrência está pausada' }, { status: 422 })
  }

  const now = new Date()

  try {
    // 1. Título do template
    const { data: template, error: tplErr } = await supabase
      .from('checklist_templates')
      .select('title')
      .eq('id', rec.template_id)
      .single()

    if (tplErr || !template) throw new Error('Template não encontrado')

    // 2. Itens do template
    const { data: templateItems, error: tiErr } = await supabase
      .from('template_items')
      .select('*')
      .eq('template_id', rec.template_id)
      .order('sort_order', { ascending: true })

    if (tiErr) throw new Error(tiErr.message)

    // 3. Criar checklist — mesmo formato do cron (em-dash, dd/MM/yyyy)
    const prefix  = rec.title_prefix ?? template.title
    const dateStr = format(now, 'dd/MM/yyyy', { locale: ptBR })
    const title   = `${prefix} — ${dateStr}`

    const { data: checklist, error: clErr } = await supabase
      .from('checklists')
      .insert({
        title,
        type:          'recurring',
        status:        'pending',
        template_id:   rec.template_id,
        unit_id:       rec.unit_id,
        assigned_to:   rec.assigned_to ?? null,
        recurrence_id: rec.id,
        created_by:    session.user.id,
      })
      .select('id')
      .single()

    if (clErr || !checklist) throw new Error(clErr?.message ?? 'Erro ao criar checklist')

    // 4. Copiar itens do template
    if (templateItems && templateItems.length > 0) {
      const items = templateItems.map((ti) => ({
        checklist_id:      checklist.id,
        description:       ti.description,
        sort_order:        ti.sort_order,
        status:            'pending' as const,
        is_done:           false,
        priority:          ti.default_priority ?? 'medium',
        estimated_minutes: ti.default_estimated_minutes ?? null,
        notes:             ti.notes_template ?? null,
        is_required:       ti.is_required ?? false,
      }))

      const { error: itemsErr } = await supabase
        .from('checklist_items')
        .insert(items)

      if (itemsErr) throw new Error(itemsErr.message)
    }

    // 5. Atualizar apenas last_generated_at — NÃO toca em next_generation_at
    await supabase
      .from('checklist_recurrence')
      .update({ last_generated_at: now.toISOString() })
      .eq('id', id)

    return Response.json({ checklist_id: checklist.id, title })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    console.error(`[generate-now] recurrence ${id}:`, message)
    return Response.json({ error: message }, { status: 500 })
  }
}
