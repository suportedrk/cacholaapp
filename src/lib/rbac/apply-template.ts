import type { SupabaseClient } from '@supabase/supabase-js'
import type { Action, Role } from '@/types/permissions'
import { SYSTEM_ONLY_ROLES, hasRole } from '@/config/roles'

interface TemplateRow {
  module_code: string
  action: string
  granted: boolean
}

interface CurrentRow {
  id: string
  module: string
  action: string
}

export interface ApplyTemplateResult {
  applied: number
  pruned: number
}

/**
 * Aplica o template de permissões de um cargo a um usuário em uma unidade.
 * Faz upsert de todas as linhas de role_permissions[role] em user_permissions.
 *
 * Usado em dois contextos:
 *   - Admin aplica template manualmente (unitId = null → permissão global)
 *   - Sistema aplica ao vincular usuário a uma unidade (unitId = id da unidade)
 *
 * opts.prune = true → além do upsert, remove as permissões ÓRFÃS (linhas em
 * user_permissions no mesmo escopo cujo module:action não está no template do
 * cargo), deixando o usuário com EXATAMENTE o template. Sem isso, trocar de
 * cargo deixava grants do cargo anterior pendurados ("sobre-permissionado").
 * super_admin é exceção: bypassa user_permissions, então não podamos.
 */
export async function applyRoleTemplate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  role: string,
  unitId: string | null,
  opts: { prune?: boolean } = {},
): Promise<ApplyTemplateResult> {
  const { data: template, error: tmplErr } = await supabase
    .from('role_permissions')
    .select('module_code, action, granted')
    .eq('role_code', role)
    .returns<TemplateRow[]>()

  if (tmplErr) throw tmplErr
  if (!template?.length) return { applied: 0, pruned: 0 }

  const rows = template.map((t) => ({
    user_id: userId,
    unit_id: unitId,
    module: t.module_code,
    action: t.action as Action,
    granted: t.granted,
  }))

  // Upsert do template ANTES da poda — garante que nenhuma permissão concedida
  // pelo template fique ausente em nenhum instante.
  const { error: upsertErr } = await supabase
    .from('user_permissions')
    .upsert(rows, { onConflict: 'user_id,unit_id,module,action' })

  if (upsertErr) throw upsertErr

  let pruned = 0

  // SYSTEM_ONLY_ROLES (super_admin) bypassa user_permissions → não podar (perms cosméticas).
  if (opts.prune && !hasRole(role as Role, SYSTEM_ONLY_ROLES)) {
    const templateKeys = new Set(template.map((t) => `${t.module_code}:${t.action}`))

    let currentQuery = supabase
      .from('user_permissions')
      .select('id, module, action')
      .eq('user_id', userId)
    currentQuery =
      unitId === null ? currentQuery.is('unit_id', null) : currentQuery.eq('unit_id', unitId)

    const { data: current, error: curErr } = await currentQuery.returns<CurrentRow[]>()
    if (curErr) throw curErr

    const orphanIds = (current ?? [])
      .filter((p) => !templateKeys.has(`${p.module}:${p.action}`))
      .map((p) => p.id)

    if (orphanIds.length) {
      const { error: delErr } = await supabase
        .from('user_permissions')
        .delete()
        .in('id', orphanIds)
      if (delErr) throw delErr
      pruned = orphanIds.length
    }
  }

  return { applied: rows.length, pruned }
}
