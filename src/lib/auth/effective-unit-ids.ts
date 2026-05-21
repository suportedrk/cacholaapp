/**
 * Resolve a lista de unidades a usar como escopo de uma query no servidor.
 *
 * Regras (ordem):
 * 1. Se `requestedUnitId` veio explícito → usa-o (caminho atual, uma unidade).
 * 2. Se for null/ausente e o usuário é viewer global (super_admin/diretor) →
 *    todas as unidades cadastradas em `public.units`.
 * 3. Caso contrário → unidades que o usuário tem em `user_units`.
 *
 * Importante: esta função NÃO tenta inferir intent — só padroniza a coleção de
 * `unit_id`s usada nas queries que antes faziam `.eq('unit_id', requestedUnitId)`.
 * O caller substitui esse `.eq` por `.in('unit_id', ids)` (lida igual com 1 ou N).
 */

import { GLOBAL_VIEWER_ROLES } from '@/config/roles'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

export type ServerSupabase = SupabaseClient<Database>

export async function getEffectiveUnitIds(
  supabase: ServerSupabase,
  requestedUnitId: string | null,
): Promise<string[]> {
  if (requestedUnitId) return [requestedUnitId]

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const isGlobalViewer =
    !!profile && (GLOBAL_VIEWER_ROLES as readonly string[]).includes(profile.role)

  if (isGlobalViewer) {
    const { data: allUnits } = await supabase.from('units').select('id')
    return (allUnits ?? []).map((u) => u.id)
  }

  const { data: userUnits } = await supabase
    .from('user_units')
    .select('unit_id')
    .eq('user_id', user.id)

  return (userUnits ?? []).map((u) => u.unit_id)
}
