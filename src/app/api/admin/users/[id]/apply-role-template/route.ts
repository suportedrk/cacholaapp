import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { ADMIN_USERS_MANAGE_ROLES } from '@/config/roles'
import { applyRoleTemplate } from '@/lib/rbac/apply-template'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireRoleApi(ADMIN_USERS_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const { id: userId } = await params
    const body = await request.json().catch(() => ({})) as { role?: string }

    const supabase = await createAdminClient()

    // Buscar role atual do usuário alvo
    const { data: targetUser, error: userErr } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (userErr || !targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    const roleToApply = body.role ?? targetUser.role

    const applied = await applyRoleTemplate(supabase, userId, roleToApply, null)

    return NextResponse.json({ applied, role: roleToApply })
  } catch (err) {
    console.error('[apply-role-template]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
