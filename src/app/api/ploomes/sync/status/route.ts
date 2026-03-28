// GET /api/ploomes/sync/status — Retorna os últimos registros de sync
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createAdminClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

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
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const latest = logs?.[0] ?? null
    const isRunning = latest?.status === 'running'

    return NextResponse.json({ logs: logs ?? [], latest, isRunning })
  } catch (err) {
    console.error('[GET /api/ploomes/sync/status]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
