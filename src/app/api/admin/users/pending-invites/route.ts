import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { ADMIN_USERS_MANAGE_ROLES } from '@/config/roles'

/**
 * GET /api/admin/users/pending-invites
 *
 * Retorna array de IDs de usuários que ainda não confirmaram o e-mail
 * (convite enviado mas não aceito — confirmed_at IS NULL em auth.users).
 *
 * Requer: ADMIN_USERS_MANAGE_ROLES (super_admin, diretor, rh)
 */
export async function GET() {
  try {
    const guard = await requireRoleApi(ADMIN_USERS_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const adminSupabase = await createAdminClient()

    // listUsers retorna até 1000 por página; para buffets < 1000 usuários é suficiente
    const { data, error } = await adminSupabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    })

    if (error) {
      console.error('[GET /api/admin/users/pending-invites]', error)
      return NextResponse.json({ error: 'Erro ao consultar usuários.' }, { status: 500 })
    }

    // confirmed_at === null → convite enviado, e-mail ainda não confirmado
    const pendingIds = data.users
      .filter((u) => u.confirmed_at === null || u.confirmed_at === undefined)
      .map((u) => u.id)

    return NextResponse.json({ pendingIds })
  } catch (err) {
    console.error('[GET /api/admin/users/pending-invites]', err)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
