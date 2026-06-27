/**
 * Helpers server-side para guards de role em layouts e API handlers.
 *
 * Uso em layouts (Server Components):
 *   await requireRoleServer(allowedRoles)
 *
 * Uso em Route Handlers (API):
 *   const result = await requireRoleApi(request, allowedRoles)
 *   if (!result.ok) return result.response
 */

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { IMPERSONATION_COOKIE, verifyImpersonationToken } from '@/lib/auth/impersonation'
import { hasRole, IMPERSONATION_ROLES } from '@/config/roles'
import type { Role } from '@/types/permissions'

/**
 * Verifica role em Server Components / layouts.
 * - Sem sessão → redirect /login
 * - Role insuficiente → redirect /403
 * - OK → retorna void (continua renderização)
 */
export async function requireRoleServer(allowed: readonly Role[]): Promise<void> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  // Modo "Ver como": se o super_admin real tem um cookie de impersonação válido (mintado
  // para ele), os guards de LAYOUT passam a avaliar contra o cargo do ALVO — assim o
  // suporte reproduz exatamente os /403 que o usuário visualizado sofreria. Só layouts:
  // as rotas de API seguem com o cargo real (ver requireRoleApi).
  const effectiveRole = await resolveEffectiveLayoutRole(supabase, user.id, profile?.role)

  if (!effectiveRole || !(allowed as readonly string[]).includes(effectiveRole)) {
    redirect('/403')
  }
}

/**
 * Cargo efetivo para guards de layout. Sem impersonação ativa, é o cargo real.
 * Com cookie de impersonação válido E chamador super_admin real E cookie mintado para ele,
 * é o cargo do usuário-alvo.
 */
async function resolveEffectiveLayoutRole(
  supabase: Awaited<ReturnType<typeof createClient>>,
  realUserId: string,
  realRole: string | undefined,
): Promise<string | undefined> {
  if (!hasRole(realRole as Role, IMPERSONATION_ROLES)) return realRole // só super_admin pode impersonar
  const store = await cookies()
  const claims = verifyImpersonationToken(store.get(IMPERSONATION_COOKIE)?.value)
  if (!claims || claims.impersonator !== realUserId) return realRole
  const { data: target } = await supabase.from('users').select('role').eq('id', claims.sub).single()
  return target?.role ?? realRole
}

/**
 * Verifica role em Route Handlers.
 * Retorna { ok: true } quando autorizado, ou { ok: false, response: NextResponse } quando não.
 */
export async function requireRoleApi(
  allowed: readonly Role[],
): Promise<{ ok: true; role: Role; userId: string } | { ok: false; response: NextResponse }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !(allowed as readonly string[]).includes(profile.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Permissão insuficiente.' }, { status: 403 }),
    }
  }

  // Devolve o cargo do chamador (aditivo, retrocompatível) — permite que o
  // handler aplique regras de menor privilégio sobre o role atribuído.
  return { ok: true, role: profile.role as Role, userId: user.id }
}
