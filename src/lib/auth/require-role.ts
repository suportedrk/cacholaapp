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
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

  if (!profile || !(allowed as readonly string[]).includes(profile.role)) {
    redirect('/403')
  }
}

/**
 * Verifica role em Route Handlers.
 * Retorna { ok: true } quando autorizado, ou { ok: false, response: NextResponse } quando não.
 */
export async function requireRoleApi(
  allowed: readonly Role[],
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
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

  return { ok: true }
}
