// POST /api/webhooks/ploomes — Recebe eventos do Ploomes via webhook
// Por enquanto: valida secret, loga payload e dispara sync do deal específico.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { syncDeals } from '@/lib/ploomes/sync'

const WEBHOOK_SECRET = process.env.PLOOMES_WEBHOOK_SECRET ?? ''

export async function POST(req: NextRequest) {
  try {
    // Validar secret no header
    const secret = req.headers.get('x-webhook-secret') ?? req.headers.get('x-ploomes-secret')
    if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
      console.warn('[Ploomes webhook] Secret inválido recebido.')
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const payload = await req.json().catch(() => null)
    console.info('[Ploomes webhook] Payload recebido:', JSON.stringify(payload))

    // Extrair dealId se presente no payload
    const dealId: number | undefined = payload?.Id ?? payload?.DealId ?? payload?.deal_id

    const supabase = await createAdminClient()

    // Disparar sync (pode ser filtrado por unidade se o payload trouxer info)
    const result = await syncDeals(supabase, {
      triggeredBy: 'webhook',
      triggeredByUserId: null,
      unitId: null, // sync global — webhook não sabe a unidade ainda
    })

    console.info(`[Ploomes webhook] Sync disparado via webhook (dealId=${dealId ?? 'todos'}).`, result)

    return NextResponse.json({ received: true, dealId, result })
  } catch (err) {
    console.error('[POST /api/webhooks/ploomes]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
