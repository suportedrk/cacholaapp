// GET /api/cron/ploomes-sync-orders — Sincroniza Orders (Vendas) do Ploomes
//
// Sync incremental: busca orders com LastUpdateDate > MAX(ploomes_last_update).
// Executar a cada 30 minutos via crontab na VPS.
//
// Chamada:
//   curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3001/api/cron/ploomes-sync-orders
//
// Crontab VPS:
//   */30 * * * * /opt/cron-call.sh /api/cron/ploomes-sync-orders >> /var/log/cachola/sync-orders.log 2>&1

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { syncOrders } from '@/lib/ploomes/sync-orders'

const CRON_SECRET = process.env.CRON_SECRET ?? ''

export async function GET(req: NextRequest) {
  const auth  = req.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null

  if (!CRON_SECRET || token !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const supabase = await createAdminClient()

  try {
    console.info('[cron/ploomes-sync-orders] Iniciando sync incremental de Orders…')
    const result = await syncOrders(supabase)
    console.info('[cron/ploomes-sync-orders] Concluído.', result)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[cron/ploomes-sync-orders] Erro fatal:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export const dynamic   = 'force-dynamic'
export const revalidate = 0
