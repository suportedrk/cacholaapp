import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { TEMPLATE_MANAGE_ROLES } from '@/config/roles'

const VALID_ACTIONS = ['view', 'create', 'edit', 'delete', 'export'] as const

export async function POST(request: Request) {
  try {
    const guard = await requireRoleApi(TEMPLATE_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const body = await request.json() as {
      role_code?: string
      module_code?: string
      action?: string
      granted?: boolean
    }

    const { role_code, module_code, action, granted } = body

    if (!role_code || !module_code || !action || granted === undefined) {
      return NextResponse.json({ error: 'role_code, module_code, action e granted são obrigatórios.' }, { status: 400 })
    }

    if (!(VALID_ACTIONS as readonly string[]).includes(action)) {
      return NextResponse.json({ error: `action inválida: ${action}` }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = await createAdminClient() as any

    // Validar role_code
    const { data: roleRow } = await supabase
      .from('roles')
      .select('code')
      .eq('code', role_code)
      .single()

    if (!roleRow) {
      return NextResponse.json({ error: `Cargo não encontrado: ${role_code}` }, { status: 400 })
    }

    // Validar module_code
    const { data: moduleRow } = await supabase
      .from('modules')
      .select('code')
      .eq('code', module_code)
      .single()

    if (!moduleRow) {
      return NextResponse.json({ error: `Módulo não encontrado: ${module_code}` }, { status: 400 })
    }

    // Buscar valor atual (pode não existir)
    const { data: existing } = await supabase
      .from('role_permissions')
      .select('granted')
      .eq('role_code', role_code)
      .eq('module_code', module_code)
      .eq('action', action)
      .maybeSingle()

    const old_granted = existing?.granted ?? false

    // UPSERT em role_permissions
    const { error: upsertErr } = await supabase
      .from('role_permissions')
      .upsert(
        { role_code, module_code, action, granted, updated_at: new Date().toISOString() },
        { onConflict: 'role_code,module_code,action' },
      )

    if (upsertErr) throw upsertErr

    // Obter id do usuário autenticado para o audit
    const { data: { user } } = await supabase.auth.getUser()
    const changedBy = user?.id ?? null

    // INSERT em role_template_audit
    const { error: auditErr } = await supabase
      .from('role_template_audit')
      .insert({ role_code, module_code, action, old_granted, new_granted: granted, changed_by: changedBy })

    if (auditErr) throw auditErr

    return NextResponse.json({ success: true, role_code, module_code, action, granted })
  } catch (err) {
    console.error('[POST /api/admin/role-permissions]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
