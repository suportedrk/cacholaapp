import { createClient } from '@supabase/supabase-js'
import { format } from 'date-fns'
import type { Database } from '@/types/database.types'
import type { ChecklistRecurrence } from '@/types/database.types'

/**
 * POST /api/cron/generate-recurring-checklists
 *
 * Gera checklists a partir de regras de recorrência ativas cujo
 * next_generation_at já chegou (≤ now).
 *
 * Para cada regra:
 *  1. Cria um checklist type='recurring' com o título "{prefix} — DD/MM/YYYY"
 *  2. Copia os itens do template (preservando priority, estimated_minutes, notes, is_required)
 *  3. Atualiza last_generated_at + recalcula next_generation_at
 *
 * Protegido por CRON_SECRET no header Authorization.
 * Chamar via: `Authorization: Bearer <CRON_SECRET>`
 */

// ─────────────────────────────────────────────────────────────
// HELPER — recalcular próxima data de geração (espelha use-checklist-recurrences.ts)
// ─────────────────────────────────────────────────────────────
function calcNextGenerationAt(
  frequency: ChecklistRecurrence['frequency'],
  dayOfWeek?: number[] | null,
  dayOfMonth?: number | null,
  timeOfDay = '08:00',
): string {
  const now = new Date()
  const [h, m] = timeOfDay.slice(0, 5).split(':').map(Number)
  let next = new Date(now)

  if (frequency === 'daily') {
    next.setDate(now.getDate() + 1)
  } else if (frequency === 'weekly' || frequency === 'biweekly') {
    const targetDay = dayOfWeek?.[0] ?? 1   // segunda-feira default
    const gap = (targetDay - now.getDay() + 7) % 7 || 7
    next.setDate(now.getDate() + gap)
    if (frequency === 'biweekly') next.setDate(next.getDate() + 7)
  } else if (frequency === 'monthly') {
    const dom = dayOfMonth ?? 1
    next = new Date(now.getFullYear(), now.getMonth(), dom)
    if (next <= now) next.setMonth(next.getMonth() + 1)
  }

  next.setHours(h, m, 0, 0)
  return next.toISOString()
}

// ─────────────────────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  // ── Segurança ──
  const authHeader   = request.headers.get('authorization')
  const expectedToken = process.env.CRON_SECRET

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Admin client (bypassa RLS) ──
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const now = new Date()
  let generated = 0
  const errors: string[] = []

  // ── Buscar regras com geração pendente ──
  const { data: recurrences, error: recErr } = await supabase
    .from('checklist_recurrence')
    .select('*')
    .eq('is_active', true)
    .lte('next_generation_at', now.toISOString())

  if (recErr) {
    return Response.json({ error: recErr.message }, { status: 500 })
  }

  for (const rec of recurrences ?? []) {
    try {
      // 1. Título do template
      const { data: template, error: tplErr } = await supabase
        .from('checklist_templates')
        .select('title')
        .eq('id', rec.template_id)
        .single()

      if (tplErr) throw new Error(tplErr.message)

      // 2. Itens do template
      const { data: templateItems, error: tiErr } = await supabase
        .from('template_items')
        .select('*')
        .eq('template_id', rec.template_id)
        .order('sort_order', { ascending: true })

      if (tiErr) throw new Error(tiErr.message)

      // 3. Criar checklist
      const prefix  = rec.title_prefix ?? template.title
      const dateStr = format(now, 'dd/MM/yyyy')
      const title   = `${prefix} — ${dateStr}`

      const { data: checklist, error: clErr } = await supabase
        .from('checklists')
        .insert({
          title,
          type:        'recurring',
          status:      'pending',
          template_id: rec.template_id,
          unit_id:     rec.unit_id,
          assigned_to: rec.assigned_to ?? null,
          recurrence_id: rec.id,
          created_by:  rec.created_by ?? null,
        })
        .select('id')
        .single()

      if (clErr) throw new Error(clErr.message)

      // 4. Copiar itens do template
      if (templateItems && templateItems.length > 0) {
        const items = templateItems.map((ti) => ({
          checklist_id:       checklist.id,
          description:        ti.description,
          sort_order:         ti.sort_order,
          status:             'pending' as const,
          is_done:            false,
          priority:           ti.default_priority ?? 'medium',
          estimated_minutes:  ti.default_estimated_minutes ?? null,
          notes:              ti.notes_template ?? null,
          is_required:        ti.is_required ?? false,
        }))

        const { error: itemsErr } = await supabase
          .from('checklist_items')
          .insert(items)

        if (itemsErr) throw new Error(itemsErr.message)
      }

      // 5. Atualizar last_generated_at + recalcular next_generation_at
      const nextAt = calcNextGenerationAt(
        rec.frequency,
        rec.day_of_week,
        rec.day_of_month,
        rec.time_of_day.slice(0, 5),
      )

      await supabase
        .from('checklist_recurrence')
        .update({
          last_generated_at:  now.toISOString(),
          next_generation_at: nextAt,
        })
        .eq('id', rec.id)

      generated++
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      errors.push(`[${rec.id}] ${msg}`)
      console.error(`[generate-recurring-checklists] recurrence ${rec.id}:`, msg)
    }
  }

  return Response.json({
    ok: true,
    generated,
    errors,
    timestamp: now.toISOString(),
  })
}
