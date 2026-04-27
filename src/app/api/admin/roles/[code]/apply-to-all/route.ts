import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { TEMPLATE_MANAGE_ROLES } from '@/config/roles'
import { applyRoleTemplate } from '@/lib/rbac/apply-template'
import type { UserRole } from '@/types/database.types'

interface UserRow {
  id: string
  email: string
  role: string
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  try {
    const guard = await requireRoleApi(TEMPLATE_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const { code } = await params

    const body = await request.json() as { confirm?: boolean }
    if (!body.confirm) {
      return NextResponse.json({ error: 'confirm: true é obrigatório.' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Validar role_code
    const { data: roleRow } = await supabase
      .from('roles')
      .select('code')
      .eq('code', code)
      .single()
      .returns<{ code: string }>()

    if (!roleRow) {
      return NextResponse.json({ error: `Cargo não encontrado: ${code}` }, { status: 404 })
    }

    // Buscar todos os usuários com este role
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('role', code as UserRole)
      .returns<UserRow[]>()

    if (usersErr) throw usersErr

    const userList = users ?? []
    const succeeded: { user_id: string; email: string; permissions_changed: number }[] = []
    const failed: { user_id: string; email: string; error_message: string }[] = []

    for (const user of userList) {
      try {
        const count = await applyRoleTemplate(supabase, user.id, code, null)
        succeeded.push({ user_id: user.id, email: user.email, permissions_changed: count })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        failed.push({ user_id: user.id, email: user.email, error_message: msg })
      }
    }

    const result = {
      success: failed.length === 0,
      succeeded,
      failed,
      total_users: userList.length,
      total_succeeded: succeeded.length,
      total_failed: failed.length,
    }

    const status = failed.length > 0 ? 207 : 200
    return NextResponse.json(result, { status })
  } catch (err) {
    console.error('[POST /api/admin/roles/[code]/apply-to-all]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
