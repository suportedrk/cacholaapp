// POST /api/units/link-team
// Vincula usuários a uma unidade (cria ou atualiza registros em user_units).

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database.types'

interface LinkTeamPayload {
  unitId: string
  members: Array<{
    userId: string
    role: UserRole
    isDefault?: boolean
  }>
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createAdminClient()

    // Auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users').select('role').eq('id', user.id).single()
    if (!profile || !['super_admin', 'diretor'].includes(profile.role)) {
      return NextResponse.json({ error: 'Acesso restrito a super_admin e diretor.' }, { status: 403 })
    }

    const body: LinkTeamPayload = await req.json()
    const { unitId, members } = body

    if (!unitId || !Array.isArray(members) || members.length === 0) {
      return NextResponse.json({ error: 'unitId e members são obrigatórios.' }, { status: 400 })
    }

    let linked = 0
    let updated = 0

    for (const member of members) {
      const { userId, role, isDefault = false } = member

      // Verificar se já existe vínculo
      const { data: existing } = await supabase
        .from('user_units')
        .select('id, role')
        .eq('unit_id', unitId)
        .eq('user_id', userId)
        .maybeSingle()

      if (existing) {
        // Atualizar role se diferente
        if (existing.role !== role) {
          await supabase.from('user_units').update({ role }).eq('id', existing.id)
          updated++
        }
      } else {
        await supabase.from('user_units').insert({
          unit_id: unitId,
          user_id: userId,
          role,
          is_default: isDefault,
        })
        linked++
      }
    }

    return NextResponse.json({ ok: true, linked, updated })
  } catch (err) {
    console.error('[POST /api/units/link-team]', err)
    return NextResponse.json({ error: 'Erro interno ao vincular equipe.' }, { status: 500 })
  }
}
