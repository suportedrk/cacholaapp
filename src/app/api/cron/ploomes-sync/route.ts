// GET /api/cron/ploomes-sync — Sincronização automática com o Ploomes CRM
// Projetado para ser chamado a cada 15 minutos por um job externo.
//
// Configuração:
//   Vercel Cron:    crons[{ path: '/api/cron/ploomes-sync', schedule: '*/15 * * * *' }]
//   GitHub Actions: curl -H "Authorization: Bearer $CRON_SECRET" https://app/.../api/cron/ploomes-sync
//   Manual:         curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/ploomes-sync
//
// Comportamento em falhas consecutivas:
//   Após 3 falhas seguidas: cria notificação interna para super_admins.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { syncDeals } from '@/lib/ploomes/sync'

const CRON_SECRET = process.env.CRON_SECRET ?? ''
const MAX_CONSECUTIVE_ERRORS = 3

export async function GET(req: NextRequest) {
  // Validar secret
  const auth = req.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (!CRON_SECRET || token !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const supabase = await createAdminClient()
  const startedAt = Date.now()

  try {
    console.info('[cron/ploomes-sync] Iniciando sync automático…')

    const result = await syncDeals(supabase, {
      triggeredBy: 'cron',
      triggeredByUserId: null,
      unitId: null, // sync global (todas as unidades)
    })

    // Verificar falhas consecutivas anteriores para resetar
    // (se chegou aqui sem throw, foi sucesso — notificações de erro podem ser limpas)
    if (result.dealsErrors > 0 && result.dealsFound === 0) {
      // Sync rodou mas não encontrou deals e teve erros — checar falhas consecutivas
      await checkAndNotifyConsecutiveErrors(supabase, true)
    } else {
      // Sync bem-sucedido — não precisa notificar
      console.info('[cron/ploomes-sync] Concluído.', {
        found: result.dealsFound,
        created: result.dealsCreated,
        updated: result.dealsUpdated,
        errors: result.dealsErrors,
        durationMs: Date.now() - startedAt,
      })
    }

    return NextResponse.json({ success: true, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[cron/ploomes-sync] Erro fatal:', message)

    // Checar e notificar falhas consecutivas
    await checkAndNotifyConsecutiveErrors(supabase, false)

    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/**
 * Verifica se há N falhas consecutivas nos logs de sync.
 * Se sim, cria uma notificação interna para os super_admins.
 */
async function checkAndNotifyConsecutiveErrors(
  supabase: Awaited<ReturnType<typeof createAdminClient>>,
  lastWasSuccess: boolean,
) {
  if (lastWasSuccess) return

  try {
    // Pegar os últimos MAX_CONSECUTIVE_ERRORS+1 logs de cron
    const { data: recentLogs } = await supabase
      .from('ploomes_sync_log')
      .select('status')
      .eq('triggered_by', 'cron')
      .order('started_at', { ascending: false })
      .limit(MAX_CONSECUTIVE_ERRORS + 1)

    if (!recentLogs || recentLogs.length < MAX_CONSECUTIVE_ERRORS) return

    const lastN = recentLogs.slice(0, MAX_CONSECUTIVE_ERRORS)
    const allFailed = lastN.every((l) => l.status === 'error')
    if (!allFailed) return

    // Havia já notificação idêntica nas últimas 2h?
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const { data: recentNotif } = await supabase
      .from('notifications')
      .select('id')
      .eq('type', 'system_alert')
      .ilike('message', '%Ploomes%sync%falhou%')
      .gte('created_at', twoHoursAgo)
      .limit(1)
      .single()

    if (recentNotif) return // Já notificou recentemente

    // Buscar super_admins para notificar
    const { data: admins } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'super_admin')
      .eq('is_active', true)

    if (!admins?.length) return

    // Criar notificação para cada admin via RPC
    for (const admin of admins) {
      await supabase.rpc('create_notification', {
        p_user_id: admin.id,
        p_type: 'system_alert',
        p_title: 'Sync Ploomes com falhas consecutivas',
        p_message: `A sincronização automática com o Ploomes falhou ${MAX_CONSECUTIVE_ERRORS} vezes seguidas. Verifique as configurações em /configuracoes/integracoes/ploomes.`,
        p_entity_type: 'ploomes_sync',
        p_entity_id: null,
      })
    }

    console.warn(`[cron/ploomes-sync] ${MAX_CONSECUTIVE_ERRORS} falhas consecutivas — admins notificados.`)
  } catch (notifErr) {
    // Falha ao notificar não deve quebrar o cron
    console.error('[cron/ploomes-sync] Erro ao verificar/notificar falhas:', notifErr)
  }
}
