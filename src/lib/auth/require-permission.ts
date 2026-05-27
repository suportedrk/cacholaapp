/**
 * Helpers server-side para guards baseados em PERMISSÃO (não cargo).
 *
 * Estes helpers chamam `public.check_permission(uid, modulo, ação)` no banco,
 * em vez de comparar `users.role` contra uma lista de cargos. Servem como
 * substituto direto dos `requireRoleServer` / `requireRoleApi` para módulos
 * cuja decisão de acesso seja configurável via `/admin/cargos` e
 * `/admin/usuarios/[id]/permissoes`.
 *
 * Itens estruturais (Aprendizado 4 — ex.: `units`, `role_permissions`)
 * NÃO devem usar estes helpers: continuam com `requireRoleServer(...)`
 * porque a trava de cargo é intencional.
 *
 * Uso em layouts (Server Components):
 *   await requirePermissionServer('eventos', 'view')
 *
 * Uso em Route Handlers (API):
 *   const guard = await requirePermissionApi('manutencao', 'edit')
 *   if (!guard.ok) return guard.response
 */

import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Module, Action } from '@/types/permissions'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

export type PermissionCheckResult =
  | { kind: 'no-session' }
  | { kind: 'denied' }
  | { kind: 'ok' }

/**
 * Função pura — recebe o cliente Supabase e retorna o resultado da checagem
 * sem efeitos colaterais (sem `redirect`, sem `NextResponse`).
 *
 * Existe separada para permitir testes unitários com stub do cliente.
 * Os wrappers `requirePermissionServer` e `requirePermissionApi` chamam
 * `evaluatePermission` e traduzem o resultado para a resposta apropriada.
 *
 * Contrato:
 * - Sem sessão (auth.getUser retorna user=null) → 'no-session'
 * - check_permission retorna false ou erro → 'denied'
 * - check_permission retorna true → 'ok'
 *
 * super_admin é bypassado dentro da própria `check_permission` (early return),
 * então não precisamos tratar aqui.
 */
export async function evaluatePermission(
  supabase: SupabaseServerClient,
  modulo: Module,
  action: Action,
): Promise<PermissionCheckResult> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { kind: 'no-session' }

  const { data, error } = await supabase.rpc('check_permission', {
    p_user_id: user.id,
    p_module: modulo,
    p_action: action,
  })

  if (error || data !== true) return { kind: 'denied' }
  return { kind: 'ok' }
}

/**
 * Verifica permissão em Server Components / layouts.
 * - Sem sessão → redirect /login
 * - Permissão negada → redirect /403
 * - OK → retorna void (continua renderização)
 */
export async function requirePermissionServer(
  modulo: Module,
  action: Action,
): Promise<void> {
  const supabase = await createClient()
  const result = await evaluatePermission(supabase, modulo, action)

  if (result.kind === 'no-session') redirect('/login')
  if (result.kind === 'denied') redirect('/403')
}

/**
 * Verifica permissão em Route Handlers.
 * Mesmo payload de erro de `requireRoleApi` para que os call sites possam
 * trocar `requireRoleApi(LISTA_ROLES)` por `requirePermissionApi(modulo, ação)`
 * sem outras mudanças.
 */
export async function requirePermissionApi(
  modulo: Module,
  action: Action,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const supabase = await createClient()
  const result = await evaluatePermission(supabase, modulo, action)

  if (result.kind === 'no-session') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Não autorizado.' }, { status: 401 }),
    }
  }
  if (result.kind === 'denied') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Permissão insuficiente.' }, { status: 403 }),
    }
  }

  return { ok: true }
}
