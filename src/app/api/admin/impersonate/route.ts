import { NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import type { Module, Action, PermissionMap } from '@/types/permissions'
import type { UserRole } from '@/types/database.types'

/**
 * GET /api/admin/impersonate?userId=<uuid>
 *
 * Retorna os dados necessários para simular a visão de outro usuário:
 * - profile: dados completos do usuário alvo
 * - userUnits: unidades vinculadas ao usuário alvo (com dados da unidade)
 * - permissions: PermissionMap resolvido (role_default_perms + overrides de user_permissions)
 *
 * Segurança:
 * - Caller deve ser super_admin (verificado via users.role com service_role)
 * - Não altera banco — só leitura
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const targetUserId = searchParams.get('userId')

    if (!targetUserId) {
      return NextResponse.json({ message: 'userId é obrigatório.' }, { status: 400 })
    }

    // ── 1. Autenticar o chamador ──────────────────────────────────────────────
    const supabase = await createClient()
    const {
      data: { user: caller },
    } = await supabase.auth.getUser()

    if (!caller) {
      return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 })
    }

    // ── 2. Verificar que o chamador é super_admin ─────────────────────────────
    // Usar supabase anon (respeita RLS — só lê o próprio usuário)
    const { data: callerProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (!callerProfile || callerProfile.role !== 'super_admin') {
      return NextResponse.json(
        { message: 'Apenas super_admin pode usar a funcionalidade "Ver como".' },
        { status: 403 }
      )
    }

    // ── 3. Usar admin client para buscar dados do alvo (ignora RLS) ───────────
    const adminSupabase = await createAdminClient()

    // ── 4. Buscar profile do alvo ─────────────────────────────────────────────
    const { data: profile, error: profileError } = await adminSupabase
      .from('users')
      .select('*')
      .eq('id', targetUserId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ message: 'Usuário não encontrado.' }, { status: 404 })
    }

    // Não permitir impersonar outro super_admin (segurança)
    if ((profile.role as UserRole) === 'super_admin' && targetUserId !== caller.id) {
      return NextResponse.json(
        { message: 'Não é possível visualizar como outro super_admin.' },
        { status: 403 }
      )
    }

    // ── 5. Buscar unidades do alvo ────────────────────────────────────────────
    const { data: userUnitsRaw, error: unitsError } = await adminSupabase
      .from('user_units')
      .select(`
        id,
        user_id,
        unit_id,
        role,
        is_default,
        created_at,
        unit:units!user_units_unit_id_fkey (
          id,
          name,
          slug,
          is_active
        )
      `)
      .eq('user_id', targetUserId)

    if (unitsError) {
      console.error('[impersonate] Erro ao buscar unidades do alvo:', unitsError)
      return NextResponse.json({ message: 'Erro ao buscar unidades do usuário.' }, { status: 500 })
    }

    const userUnits = (userUnitsRaw ?? []).map((uu) => ({
      ...uu,
      unit: Array.isArray(uu.unit) ? uu.unit[0] : uu.unit,
    }))

    // ── 6. Resolver permissões do alvo ────────────────────────────────────────
    // Baseline: role_default_perms para o role do alvo
    const targetRole = profile.role as UserRole

    const { data: defaults } = await adminSupabase
      .from('role_default_perms')
      .select('module, action, granted')
      .eq('role', targetRole)

    // Overrides individuais em user_permissions
    const { data: overrides } = await adminSupabase
      .from('user_permissions')
      .select('module, action, granted')
      .eq('user_id', targetUserId)

    // Montar PermissionMap: defaults → overrides (overrides ganham)
    const permMap: Partial<PermissionMap> = {}

    for (const perm of defaults ?? []) {
      const mod = perm.module as Module
      if (!permMap[mod]) permMap[mod] = {} as Record<Action, boolean>
      ;(permMap[mod] as Record<Action, boolean>)[perm.action as Action] = perm.granted
    }

    for (const perm of overrides ?? []) {
      const mod = perm.module as Module
      if (!permMap[mod]) permMap[mod] = {} as Record<Action, boolean>
      ;(permMap[mod] as Record<Action, boolean>)[perm.action as Action] = perm.granted
    }

    const permissions = permMap as PermissionMap

    // ── 7. Registrar audit log (fire-and-forget, nunca bloqueia) ──────────────
    void logAudit({
      action: 'impersonate_start',
      module: 'users',
      entityId: targetUserId,
      entityType: 'user',
      newData: {
        target_user_id: targetUserId,
        target_name: profile.name,
        target_role: profile.role,
        admin_id: caller.id,
      },
    })

    // ── 8. Retornar dados ─────────────────────────────────────────────────────
    return NextResponse.json({ profile, userUnits, permissions })
  } catch (err) {
    console.error('[GET /api/admin/impersonate]', err)
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 })
  }
}
