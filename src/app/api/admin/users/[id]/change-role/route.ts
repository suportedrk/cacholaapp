import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { ADMIN_USERS_MANAGE_ROLES } from '@/config/roles'
import { applyRoleTemplate } from '@/lib/rbac/apply-template'
import type { UserRole } from '@/types/database.types'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireRoleApi(ADMIN_USERS_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const { id: userId } = await params
    const body = await request.json() as { role: string; user_unit_id: string }

    if (!body.role || !body.user_unit_id) {
      return NextResponse.json(
        { error: 'Campos obrigatórios ausentes: role, user_unit_id.' },
        { status: 400 }
      )
    }

    const supabase = await createAdminClient()

    // Validar que o usuário existe
    const { data: targetUser, error: userErr } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .single()

    if (userErr || !targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    // Atualizar user_units.role (cargo na unidade)
    const { error: unitErr } = await supabase
      .from('user_units')
      .update({ role: body.role as UserRole })
      .eq('id', body.user_unit_id)

    if (unitErr) {
      return NextResponse.json({ error: 'Erro ao atualizar vínculo.' }, { status: 500 })
    }

    // Atualizar users.role (cargo global — fonte de verdade per Decisão 4)
    const { error: roleErr } = await supabase
      .from('users')
      .update({ role: body.role as UserRole })
      .eq('id', userId)

    if (roleErr) {
      return NextResponse.json({ error: 'Erro ao atualizar cargo.' }, { status: 500 })
    }

    // Aplicar template de permissões para o novo cargo (global, unit_id=null)
    const applied = await applyRoleTemplate(supabase, userId, body.role, null)

    return NextResponse.json({ ok: true, applied, role: body.role })
  } catch (err) {
    console.error('[change-role]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
