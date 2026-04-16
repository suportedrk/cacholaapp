// POST /api/webhooks/ploomes — Recebe eventos do Ploomes via webhook
//
// Validação: header X-Ploomes-Validation-Key (env PLOOMES_VALIDATION_KEY)
// Payload Ploomes: { Action, Entity, Old, New, ... }
//   Action: "Win" | "Update" | "Lose" | "Create" | "Delete"
//   Entity: "Deal" ou "Deals" (o Ploomes envia no plural — normalizado internamente)
//   New.Id: número do deal afetado
//
// Comportamento por action:
//   Win    → sync do deal específico (fechou como ganho)
//   Update → sync do deal específico (dados atualizados)
//   Lose   → sync do deal específico (marcado como perdido)
//   outros → skipped (registrado mas não processado)
//
// Idempotência: mesmo dealId processado com sucesso nos últimos 30s → skipped

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { syncDeals } from '@/lib/ploomes/sync'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

const VALIDATION_KEY = process.env.PLOOMES_VALIDATION_KEY ?? ''

// ── Tipos do payload de webhook Ploomes ──────────────────────

type PloomesWebhookPayload = {
  Action?: string
  Entity?: string
  New?: { Id?: number; [key: string]: unknown }
  Old?: { Id?: number; [key: string]: unknown }
  Id?: number
  DealId?: number
}

type WebhookStatus = 'received' | 'processing' | 'success' | 'error' | 'skipped'

// ── Helper para atualizar o log ───────────────────────────────

async function updateWebhookLog(
  supabase: SupabaseClient<Database>,
  id: string | null,
  status: WebhookStatus,
  errorMessage: string | null,
  startTime: number,
  syncLogId?: string | null,
) {
  if (!id) return
  await supabase
    .from('ploomes_webhook_log')
    .update({
      status,
      error_message: errorMessage,
      processing_ms: Date.now() - startTime,
      ...(syncLogId !== undefined ? { sync_log_id: syncLogId } : {}),
    })
    .eq('id', id)
}

// ── Handler ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  const supabase = await createAdminClient()
  let webhookLogId: string | null = null

  try {
    // ── 1. Validar chave de verificação ──────────────────────
    const receivedKey = req.headers.get('x-ploomes-validation-key') ?? ''

    if (VALIDATION_KEY && receivedKey !== VALIDATION_KEY) {
      console.warn('[Ploomes webhook] Chave de validação inválida.')
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    // ── 2. Ler payload ────────────────────────────────────────
    const payload = await req.json().catch(() => null) as PloomesWebhookPayload | null

    const action = payload?.Action?.trim() ?? ''
    // O Ploomes envia "Deals" (plural) — normalizar para "deal" singular lowercase
    const rawEntity = payload?.Entity?.trim() ?? ''
    const entity    = rawEntity.toLowerCase().replace(/s$/, '') // "Deals" → "deal", "Deal" → "deal"
    const dealId: number | undefined =
      payload?.New?.Id ??
      payload?.Old?.Id ??
      payload?.Id ??
      payload?.DealId

    console.info('[Ploomes webhook] Recebido:', JSON.stringify({ action, entity, rawEntity, dealId }))

    // ── 3. Registrar no log (status: received) ────────────────
    const { data: logEntry } = await supabase
      .from('ploomes_webhook_log')
      .insert({
        deal_id: dealId ?? null,
        action: action || null,
        entity: rawEntity || null,   // gravar o valor original do payload
        status: 'received' as WebhookStatus,
        raw_payload: payload as Record<string, unknown>,
      })
      .select('id')
      .single()

    webhookLogId = logEntry?.id ?? null

    // ── 4. Filtrar: só processar Deal Win/Update/Lose ─────────
    // entity já normalizado: "deal" (singular lowercase)
    const SYNC_ACTIONS = ['Win', 'Update', 'Lose']

    if ((entity && entity !== 'deal') || (action && !SYNC_ACTIONS.includes(action))) {
      console.info(`[Ploomes webhook] Ignorado: entity=${rawEntity}(→${entity}), action=${action}`)
      await updateWebhookLog(supabase, webhookLogId, 'skipped', null, startTime)
      return NextResponse.json({ received: true, status: 'skipped', action, entity: rawEntity })
    }

    // ── 5. Idempotência: dealId processado nos últimos 30s ────
    if (dealId) {
      const thirtySecondsAgo = new Date(Date.now() - 30_000).toISOString()
      const { data: recent } = await supabase
        .from('ploomes_webhook_log')
        .select('id')
        .eq('deal_id', dealId)
        .eq('status', 'success')
        .gte('received_at', thirtySecondsAgo)
        .neq('id', webhookLogId ?? '') // ignorar o próprio registro atual
        .limit(1)

      if (recent && recent.length > 0) {
        console.info(`[Ploomes webhook] Deduplicado: dealId=${dealId} processado nos últimos 30s`)
        await updateWebhookLog(supabase, webhookLogId, 'skipped', null, startTime)
        return NextResponse.json({ received: true, status: 'deduplicated', dealId })
      }
    }

    // ── 6. Marcar como processing ─────────────────────────────
    await updateWebhookLog(supabase, webhookLogId, 'processing', null, startTime)

    // ── 7. Sync cirúrgico: apenas o deal específico ───────────
    const result = await syncDeals(supabase, {
      triggeredBy: 'webhook',
      triggeredByUserId: null,
      unitId: null,      // resolveUnitId interno via ploomes_unit_mapping
      dealId: dealId,    // sync cirúrgico — apenas este deal
    })

    // ── 8. Marcar como success ────────────────────────────────
    await updateWebhookLog(supabase, webhookLogId, 'success', null, startTime)

    console.info(`[Ploomes webhook] Concluído: dealId=${dealId ?? 'n/a'}, durationMs=${Date.now() - startTime}`)

    return NextResponse.json({ received: true, status: 'processed', dealId, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/webhooks/ploomes]', message)

    if (webhookLogId) {
      await updateWebhookLog(supabase, webhookLogId, 'error', message, startTime)
    }

    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
