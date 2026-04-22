import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { ADMIN_USERS_MANAGE_ROLES } from '@/config/roles'

/**
 * POST /api/admin/resend-invite
 *
 * Reenvia o e-mail de convite para um usuário com confirmação pendente.
 * Usa inviteUserByEmail novamente — o GoTrue sobrescreve o token anterior.
 *
 * Body: { userId: string }
 * Requer: ADMIN_USERS_MANAGE_ROLES (super_admin, diretor, rh)
 */
export async function POST(request: Request) {
  try {
    const guard = await requireRoleApi(ADMIN_USERS_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const body = await request.json()
    const { userId } = body as { userId: string }

    if (!userId) {
      return NextResponse.json({ error: 'userId é obrigatório.' }, { status: 400 })
    }

    const adminSupabase = await createAdminClient()

    // Busca o usuário para obter o e-mail e confirmar que ainda está pendente
    const { data: authUser, error: getUserError } = await adminSupabase.auth.admin.getUserById(userId)

    if (getUserError || !authUser.user) {
      return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 })
    }

    if (authUser.user.confirmed_at) {
      return NextResponse.json(
        { error: 'Este usuário já confirmou o e-mail.' },
        { status: 400 }
      )
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cachola.cloud'

    const { error: inviteError } = await adminSupabase.auth.admin.inviteUserByEmail(
      authUser.user.email!,
      { redirectTo: `${appUrl}/auth/confirm` }
    )

    if (inviteError) {
      console.error('[POST /api/admin/resend-invite]', inviteError)
      return NextResponse.json(
        { error: 'Erro ao reenviar convite. Tente novamente.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[POST /api/admin/resend-invite]', err)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
