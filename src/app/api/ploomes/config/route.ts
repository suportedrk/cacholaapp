// GET  /api/ploomes/config    — Retorna a config da unidade ativa
// POST /api/ploomes/config    — Cria config (primeira vez)
// PATCH /api/ploomes/config   — Atualiza campos específicos
//
// Apenas super_admin, diretor e gerente têm acesso.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'

async function requireRole(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['super_admin', 'diretor', 'gerente'].includes(profile.role)) {
    return null
  }
  return user
}

// ── GET ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await requireRole(req)
  if (!user) return NextResponse.json({ error: 'Proibido.' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const unitId = searchParams.get('unit_id')

  const supabase = await createAdminClient()
  let query = supabase
    .from('ploomes_config')
    .select('*')
    .eq('is_active', true)

  if (unitId) query = query.eq('unit_id', unitId)

  const { data, error } = await query.limit(1).maybeSingle()

  if (error) {
    console.error('[GET /api/ploomes/config]', error)
    return NextResponse.json({ error: 'Erro ao buscar configuração.' }, { status: 500 })
  }

  return NextResponse.json({ config: data })
}

// ── POST ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await requireRole(req)
  if (!user) return NextResponse.json({ error: 'Proibido.' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body?.unit_id) {
    return NextResponse.json({ error: 'unit_id obrigatório.' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  const { data, error } = await supabase
    .from('ploomes_config')
    .insert({
      unit_id: body.unit_id,
      pipeline_id: body.pipeline_id ?? 60000636,
      stage_id: body.stage_id ?? 60004787,
      won_status_id: body.won_status_id ?? 1,
      field_mappings: body.field_mappings ?? {},
      contact_mappings: body.contact_mappings ?? {},
      status_mappings: body.status_mappings ?? {},
    })
    .select()
    .single()

  if (error) {
    console.error('[POST /api/ploomes/config]', error)
    return NextResponse.json({ error: 'Erro ao criar configuração.' }, { status: 500 })
  }

  return NextResponse.json({ config: data }, { status: 201 })
}

// ── PATCH ─────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const user = await requireRole(req)
  if (!user) return NextResponse.json({ error: 'Proibido.' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body?.unit_id) {
    return NextResponse.json({ error: 'unit_id obrigatório.' }, { status: 400 })
  }

  const { unit_id, ...fields } = body

  // Campos permitidos para atualização
  const allowed = [
    'user_key',
    'pipeline_id', 'stage_id', 'won_status_id',
    'field_mappings', 'contact_mappings', 'status_mappings',
    'webhook_url', 'webhook_registered_at', 'is_active',
  ]
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in fields) update[key] = fields[key]
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo válido para atualizar.' }, { status: 400 })
  }

  // Usa createClient (cookie auth) para que as políticas RLS de UPDATE se apliquem.
  // O manager autenticado via cookie tem permissão de UPDATE pela migration 024.
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('ploomes_config')
    .update(update)
    .eq('unit_id', unit_id)
    .select()
    .maybeSingle()

  if (error) {
    console.error('[PATCH /api/ploomes/config]', error)
    return NextResponse.json({ error: 'Erro ao atualizar configuração.', detail: error.message, code: error.code }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Configuração não encontrada para esta unidade.' }, { status: 404 })
  }

  return NextResponse.json({ config: data })
}
