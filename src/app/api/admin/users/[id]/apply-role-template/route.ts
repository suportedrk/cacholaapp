import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { ADMIN_USERS_MANAGE_ROLES, assertAssignableRole } from '@/config/roles'
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

    // Allowlist anti mass-assignment + trava super_admin. Valida o role efetivo
    // (body.role quando fornecido; senão o cargo atual do alvo).
    const roleCheck = assertAssignableRole(body.role ?? targetUser.role, guard.role)
    if (!roleCheck.ok) {
      return NextResponse.json({ error: roleCheck.error }, { status: roleCheck.status })
    }
    const roleToApply = roleCheck.role

    // prune=true → alinha o usuário EXATAMENTE ao template (remove órfãs), coerente
    // com o diff que agora mostra as órfãs como "Remover".
    const { applied, pruned } = await applyRoleTemplate(supabase, userId, roleToApply, null, {
      prune: true,
    })

    return NextResponse.json({ applied, pruned, role: roleToApply })
  } catch (err) {
    console.error('[apply-role-template]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
