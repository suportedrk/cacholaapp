import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { hasRole, ADMIN_USERS_MANAGE_ROLES, VENDEDORA_ROLES } from '@/config/roles'
import type { UserRole } from '@/types/database.types'

export async function POST(request: Request) {
  try {
    const guard = await requireRoleApi(ADMIN_USERS_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const adminSupabase = await createAdminClient()

    const body = await request.json()
    const { name, email, phone, role, seller_id } = body as {
      name: string
      email: string
      phone: string | null
      role: UserRole
      seller_id?: string | null
    }

    if (!name || !email || !role) {
      return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 })
    }

    if (hasRole(role, VENDEDORA_ROLES) && !seller_id) {
      return NextResponse.json(
        { error: 'Campo "Vincular à vendedora" é obrigatório para o cargo Vendedora.' },
        { status: 400 }
      )
    }

    if (hasRole(role, VENDEDORA_ROLES) && seller_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sellerCheck } = await (adminSupabase as any)
        .from('sellers')
        .select('id, status, is_system_account')
        .eq('id', seller_id)
        .maybeSingle() as { data: { id: string; status: string; is_system_account: boolean } | null }
      if (!sellerCheck) {
        return NextResponse.json({ error: 'Vendedora não encontrada.' }, { status: 400 })
      }
      if (sellerCheck.status !== 'active' || sellerCheck.is_system_account) {
        return NextResponse.json(
          { error: 'Vendedora inválida: inativa ou conta de sistema.' },
          { status: 400 }
        )
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existingUser } = await (adminSupabase as any)
        .from('users')
        .select('id')
        .eq('seller_id', seller_id)
        .maybeSingle() as { data: { id: string } | null }
      if (existingUser) {
        return NextResponse.json(
          { error: 'Esta vendedora já está vinculada a outro usuário.' },
          { status: 400 }
        )
      }
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cachola.cloud'

    const { data: newUser, error: createError } = await adminSupabase.auth.admin.inviteUserByEmail(
      email,
      {
        data: { name, phone, role },
        redirectTo: `${appUrl}/auth/confirm`,
      },
    )

    if (createError) {
      const msg = createError.message.includes('already registered')
        ? 'Este e-mail já está cadastrado.'
        : createError.message
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    if (newUser.user) {
      const updatePayload: Record<string, unknown> = {
        role,
        phone: phone ?? null,
      }
      if (seller_id) updatePayload.seller_id = seller_id

      await adminSupabase
        .from('users')
        .update(updatePayload)
        .eq('id', newUser.user.id)
    }

    return NextResponse.json({ id: newUser.user?.id }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/users]', err)
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 })
  }
}
