import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { ADMIN_USERS_MANAGE_ROLES } from '@/config/roles'
import type { Action } from '@/types/permissions'

interface TemplateRow {
  module_code: string
  action: string
  granted: boolean
  modules: { label: string }
}

interface PermRow {
  module: string
  action: string
  granted: boolean
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const guard = await requireRoleApi(ADMIN_USERS_MANAGE_ROLES)
    if (!guard.ok) return guard.response

    const { id: userId } = await params
    const { searchParams } = new URL(request.url)

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

    // Role a simular: ?role= (para preview de mudança de cargo) ou role atual
    const appliedRole = searchParams.get('role') ?? targetUser.role

    // Template do cargo
    const { data: template, error: tmplErr } = await supabase
      .from('role_permissions')
      .select('module_code, action, granted, modules!inner(label)')
      .eq('role_code', appliedRole)
      .returns<TemplateRow[]>()

    if (tmplErr) {
      return NextResponse.json({ error: 'Erro ao carregar template.' }, { status: 500 })
    }

    // Permissões atuais do usuário
    const { data: current, error: permErr } = await supabase
      .from('user_permissions')
      .select('module, action, granted')
      .eq('user_id', userId)
      .is('unit_id', null)
      .returns<PermRow[]>()

    if (permErr) {
      return NextResponse.json({ error: 'Erro ao carregar permissões.' }, { status: 500 })
    }

    // Índice: module+action → granted
    const currentMap = new Map<string, boolean>()
    for (const p of current ?? []) {
      currentMap.set(`${p.module}:${p.action}`, p.granted)
    }

    // Diff
    const diffs = (template ?? []).map((t) => {
      const key = `${t.module_code}:${t.action}`
      const currentVal = currentMap.has(key) ? currentMap.get(key)! : null
      const templateVal = t.granted
      return {
        module: t.module_code,
        module_label: t.modules.label,
        action: t.action as Action,
        current: currentVal,
        template: templateVal,
        has_diff: currentVal !== templateVal,
      }
    })

    const changedCount = diffs.filter((d) => d.has_diff).length

    return NextResponse.json({
      user_role: targetUser.role,
      applied_role: appliedRole,
      diffs,
      changed_count: changedCount,
    })
  } catch (err) {
    console.error('[role-template-diff]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
