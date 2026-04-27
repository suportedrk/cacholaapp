import type { SupabaseClient } from '@supabase/supabase-js'
import type { Action } from '@/types/permissions'

interface TemplateRow {
  module_code: string
  action: string
  granted: boolean
}

/**
 * Aplica o template de permissões de um cargo a um usuário em uma unidade.
 * Faz upsert de todas as linhas de role_permissions[role] em user_permissions.
 *
 * Usado em dois contextos:
 *   - Admin aplica template manualmente (unitId = null → permissão global)
 *   - Sistema aplica ao vincular usuário a uma unidade (unitId = id da unidade)
 */
export async function applyRoleTemplate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  userId: string,
  role: string,
  unitId: string | null,
): Promise<number> {
  const { data: template, error: tmplErr } = await supabase
    .from('role_permissions')
    .select('module_code, action, granted')
    .eq('role_code', role)
    .returns<TemplateRow[]>()

  if (tmplErr) throw tmplErr
  if (!template?.length) return 0

  const rows = template.map((t) => ({
    user_id: userId,
    unit_id: unitId,
    module: t.module_code,
    action: t.action as Action,
    granted: t.granted,
  }))

  const { error: upsertErr } = await supabase
    .from('user_permissions')
    .upsert(rows, { onConflict: 'user_id,unit_id,module,action' })

  if (upsertErr) throw upsertErr
  return rows.length
}
