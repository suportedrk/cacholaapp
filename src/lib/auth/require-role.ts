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
import { logAudit } from '@/lib/audit'
import { hasRole, IMPERSONATION_ROLES } from '@/config/roles'
import type { Role } from '@/types/permissions'

/**
 * True quando o chamador (sessão real) está num "Ver como" ativo — cookie de impersonação
 * válido E mintado para ELE. Usado pelos guards de API para recusar escrita (o read-only do
 * banco só cobre o token mintado do browser; rotas de API rodam com a sessão do admin, que
 * NÃO carrega o claim → gravariam de verdade como o admin). Read-only de borda, fail-closed.
 */
export async function callerIsImpersonating(callerId: string): Promise<boolean> {
  const store = await cookies()
  const claims = verifyImpersonationToken(store.get(IMPERSONATION_COOKIE)?.value)
  return !!claims && claims.impersonator === callerId
}

/** Resposta 403 padrão de "somente leitura" + audit do bloqueio (fecha o gap de auditoria). */
export function impersonationReadOnlyBlock(callerId: string, context: string): NextResponse {
  void logAudit({
    action: 'impersonate_write_blocked',
    module: 'users',
    entityType: 'api',
    newData: { admin_id: callerId, context },
  })
  return NextResponse.json({ error: 'Modo "Ver como" é somente leitura.' }, { status: 403 })
}

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

  // Modo "Ver como" = somente leitura também nas rotas de API: as APIs rodam com a sessão
  // do admin (sem o claim), então o read-only do banco não as alcança — recusamos na borda.
  // (requireRoleApi gateia rotas predominantemente de escrita/admin; bloquear é fail-closed.)
  if (await callerIsImpersonating(user.id)) {
    return { ok: false, response: impersonationReadOnlyBlock(user.id, 'requireRoleApi') }
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
