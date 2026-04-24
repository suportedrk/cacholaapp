// POST /api/admin/units
// Cria uma nova unidade (server-side, service role) e vincula o criador em user_units.
// Evita problemas de lock/token do Supabase client-side em produção.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { ADMIN_ACCESS_ROLES } from '@/config/roles'

interface CreateUnitPayload {
  name: string
  slug: string
  address?: string | null
  phone?: string | null
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createAdminClient()

    // ── Auth ─────────────────────────────────────────────────────
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !(ADMIN_ACCESS_ROLES as readonly string[]).includes(profile.role)) {
      return NextResponse.json(
        { error: 'Acesso restrito a super_admin e diretor.' },
        { status: 403 }
      )
    }

    // ── Validação ────────────────────────────────────────────────
    const body: CreateUnitPayload = await req.json()
    const { name, slug, address, phone } = body

    if (!name?.trim() || !slug?.trim()) {
      return NextResponse.json(
        { error: 'Nome e slug são obrigatórios.' },
        { status: 400 }
      )
    }

    // ── Criar unidade ────────────────────────────────────────────
    const { data: unit, error: unitErr } = await supabase
      .from('units')
      .insert({
        name: name.trim(),
        slug: slug.trim(),
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        is_active: true,
      })
      .select('id, name, slug')
      .single()

    if (unitErr) {
      if (unitErr.code === '23505') {
        return NextResponse.json(
          { error: 'Já existe uma unidade com esse slug. Escolha um diferente.' },
          { status: 409 }
        )
      }
      console.error('[POST /api/admin/units] Erro ao criar unidade:', unitErr.message)
      return NextResponse.json({ error: unitErr.message }, { status: 500 })
    }

    // ── Vincular criador à nova unidade ──────────────────────────
    const { error: linkErr } = await supabase
      .from('user_units')
      .insert({
        user_id: user.id,
        unit_id: unit.id,
        role: profile.role,
        is_default: false,
      })

    if (linkErr) {
      // Não-fatal: unidade foi criada com sucesso — apenas loga
      console.error('[POST /api/admin/units] Erro ao vincular criador:', linkErr.message)
    }

    return NextResponse.json({ ok: true, unit })
  } catch (err) {
    console.error('[POST /api/admin/units]', err)
    return NextResponse.json({ error: 'Erro interno ao criar unidade.' }, { status: 500 })
  }
}
