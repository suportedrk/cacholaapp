// GET /api/ploomes/sync/status — Retorna os últimos registros de sync
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { requireRoleApi } from '@/lib/auth/require-role'
import { SETTINGS_ROLES } from '@/config/roles'

export async function GET() {
  try {
    // Guard: status de sync via service_role — restringir a quem administra a
    // integração (super_admin, diretor), consistente com ploomes/sync e config.
    const guard = await requireRoleApi(SETTINGS_ROLES)
    if (!guard.ok) return guard.response

    const supabase = await createAdminClient()

    const { data: logs, error } = await supabase
      .from('ploomes_sync_log')
      .select(`
        id,
        started_at,
        finished_at,
        status,
        deals_found,
        deals_created,
        deals_updated,
        deals_errors,
        venues_created,
        types_created,
        error_message,
        triggered_by,
        triggered_by_user_id,
        unit_id
      `)
      .order('started_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('[GET /api/ploomes/sync/status]', error)
      return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
    }

    const latest = logs?.[0] ?? null
    const isRunning = latest?.status === 'running'

    return NextResponse.json({ logs: logs ?? [], latest, isRunning })
  } catch (err) {
    console.error('[GET /api/ploomes/sync/status]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
