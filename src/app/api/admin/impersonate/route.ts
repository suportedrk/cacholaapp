import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logAudit } from '@/lib/audit'
import type { Module, Action, PermissionMap } from '@/types/permissions'
import type { UserRole } from '@/types/database.types'
import { hasRole, IMPERSONATION_ROLES } from '@/config/roles'
import {
  mintImpersonationToken,
  IMPERSONATION_COOKIE,
  IMPERSONATION_TTL_SECONDS,
  verifyImpersonationToken,
} from '@/lib/auth/impersonation'

/**
 * Modo "Ver como" (impersonation 2A).
 *
 * POST   /api/admin/impersonate  { userId }  → inicia: minta o JWT do alvo, seta o cookie
 *                                               httpOnly de impersonação e devolve o token +
 *                                               contexto (profile/userUnits/permissions).
 * DELETE /api/admin/impersonate              → encerra: limpa o cookie.
 * GET    /api/admin/impersonate              → re-hidrata após F5: se o cookie for válido e
 *                                               o chamador for super_admin real, devolve o
 *                                               token + contexto novamente.
 *
 * Segurança:
 * - SEMPRE gateado pelo cargo REAL do chamador (a sessão GoTrue intacta), NUNCA pelo cargo
 *   impersonado. Só super_admin (IMPERSONATION_ROLES) pode operar.
 * - Não minta para super_admin nem para si mesmo.
 * - O read-only é imposto no banco (migrations 175/176/177); aqui não há escrita de dados.
 */

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

/**
 * Defesa CSRF: aceita apenas requisições de mesma origem. Usa Sec-Fetch-Site (enviado
 * pelos browsers modernos) e cai para comparação Origin×Host quando ausente. Bloqueia
 * cross-site antes de qualquer minta/limpeza de cookie ou retorno de token.
 */
function isSameOrigin(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site')
  if (site) return site === 'same-origin' || site === 'none'
  const origin = request.headers.get('origin')
  if (!origin) return true // navegação direta sem Origin (a sessão já é exigida)
  try {
    return new URL(origin).host === request.headers.get('host')
  } catch {
    return false
  }
}

/** Autentica e exige que o cargo REAL do chamador seja super_admin. */
async function requireRealSuperAdmin() {
  const supabase = await createClient()
  const {
    data: { user: caller },
  } = await supabase.auth.getUser()
  if (!caller) {
    return { ok: false as const, response: NextResponse.json({ message: 'Não autenticado.' }, { status: 401 }) }
  }
  // RLS: o usuário só lê o próprio registro — cargo real, imune ao cookie de impersonação.
  const { data: callerProfile } = await supabase.from('users').select('role').eq('id', caller.id).single()
  if (!callerProfile || !hasRole(callerProfile.role as UserRole, IMPERSONATION_ROLES)) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { message: 'Apenas super_admin pode usar a funcionalidade "Ver como".' },
        { status: 403 }
      ),
    }
  }
  return { ok: true as const, callerId: caller.id }
}

/** Carrega profile + unidades + permissões EFETIVAS (user_permissions) do alvo. */
async function loadTargetContext(targetId: string) {
  const adminSupabase = await createAdminClient()

  const { data: profile, error: profileError } = await adminSupabase
    .from('users')
    .select('*')
    .eq('id', targetId)
    .single()
  if (profileError || !profile) return { error: 'not_found' as const }

  const { data: userUnitsRaw, error: unitsError } = await adminSupabase
    .from('user_units')
    .select(`
      id, user_id, unit_id, is_default, created_at,
      unit:units!user_units_unit_id_fkey ( id, name, slug, is_active )
    `)
    .eq('user_id', targetId)
  if (unitsError) return { error: 'units' as const }

  const userUnits = (userUnitsRaw ?? []).map((uu) => ({
    ...uu,
    unit: Array.isArray(uu.unit) ? uu.unit[0] : uu.unit,
  }))

  // Permissões EFETIVAS = user_permissions do alvo (mesma fonte que o app usa de fato;
  // role_default_perms é legado/incompleto e foi abandonado de propósito).
  const { data: perms } = await adminSupabase
    .from('user_permissions')
    .select('module, action, granted')
    .eq('user_id', targetId)

  const permMap: Partial<PermissionMap> = {}
  for (const perm of perms ?? []) {
    const mod = perm.module as Module
    if (!permMap[mod]) permMap[mod] = {} as Record<Action, boolean>
    ;(permMap[mod] as Record<Action, boolean>)[perm.action as Action] = perm.granted
  }

  return { profile, userUnits, permissions: permMap as PermissionMap }
}

// ── POST: inicia o "Ver como" ───────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ message: 'Origem inválida.' }, { status: 403 })
    }
    const auth = await requireRealSuperAdmin()
    if (!auth.ok) return auth.response

    const body = await request.json().catch(() => ({}))
    const targetUserId: unknown = body?.userId
    if (typeof targetUserId !== 'string' || !targetUserId) {
      return NextResponse.json({ message: 'userId é obrigatório.' }, { status: 400 })
    }
    if (targetUserId === auth.callerId) {
      return NextResponse.json({ message: 'Não é possível visualizar como você mesmo.' }, { status: 400 })
    }

    const ctx = await loadTargetContext(targetUserId)
    if ('error' in ctx) {
      return NextResponse.json({ message: 'Usuário não encontrado.' }, { status: 404 })
    }

    // Não permitir impersonar outro super_admin.
    if (hasRole(ctx.profile.role as UserRole, IMPERSONATION_ROLES)) {
      return NextResponse.json(
        { message: 'Não é possível visualizar como outro super_admin.' },
        { status: 403 }
      )
    }

    const nowSeconds = Math.floor(Date.now() / 1000)
    const token = mintImpersonationToken({
      targetId: targetUserId,
      targetEmail: ctx.profile.email ?? null,
      adminId: auth.callerId,
      nowSeconds,
    })

    void logAudit({
      action: 'impersonate_start',
      module: 'users',
      entityId: targetUserId,
      entityType: 'user',
      newData: {
        target_user_id: targetUserId,
        target_name: ctx.profile.name,
        target_role: ctx.profile.role,
        admin_id: auth.callerId,
      },
    })

    const res = NextResponse.json({
      token,
      profile: ctx.profile,
      userUnits: ctx.userUnits,
      permissions: ctx.permissions,
    })
    res.cookies.set(IMPERSONATION_COOKIE, token, { ...COOKIE_OPTS, maxAge: IMPERSONATION_TTL_SECONDS })
    return res
  } catch (err) {
    console.error('[POST /api/admin/impersonate]', err)
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 })
  }
}

// ── DELETE: encerra o "Ver como" ────────────────────────────────────────────
export async function DELETE(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ message: 'Origem inválida.' }, { status: 403 })
    }
    const auth = await requireRealSuperAdmin()
    if (!auth.ok) return auth.response

    void logAudit({
      action: 'impersonate_stop',
      module: 'users',
      entityType: 'user',
      newData: { admin_id: auth.callerId },
    })

    const res = NextResponse.json({ ok: true })
    res.cookies.set(IMPERSONATION_COOKIE, '', { ...COOKIE_OPTS, maxAge: 0 })
    return res
  } catch (err) {
    console.error('[DELETE /api/admin/impersonate]', err)
    return NextResponse.json({ message: 'Erro interno do servidor.' }, { status: 500 })
  }
}

// ── GET: re-hidrata após F5 (se o cookie ainda for válido) ───────────────────
export async function GET(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ active: false }, { status: 403 })
    }
    const auth = await requireRealSuperAdmin()
    if (!auth.ok) {
      // Sem super_admin real não há o que re-hidratar; não vaza erro.
      return NextResponse.json({ active: false })
    }

    const store = await cookies()
    const cookieValue = store.get(IMPERSONATION_COOKIE)?.value
    const claims = verifyImpersonationToken(cookieValue)

    // Só re-hidrata se o cookie foi mintado PARA este admin.
    if (!claims || claims.impersonator !== auth.callerId) {
      return NextResponse.json({ active: false })
    }

    const ctx = await loadTargetContext(claims.sub)
    if ('error' in ctx) return NextResponse.json({ active: false })

    return NextResponse.json({
      active: true,
      token: cookieValue,
      profile: ctx.profile,
      userUnits: ctx.userUnits,
      permissions: ctx.permissions,
    })
  } catch (err) {
    console.error('[GET /api/admin/impersonate]', err)
    return NextResponse.json({ active: false })
  }
}
