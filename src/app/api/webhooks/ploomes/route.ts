// POST /api/webhooks/ploomes — Recebe eventos do Ploomes via webhook
//
// Validação: header X-Ploomes-Validation-Key (env PLOOMES_VALIDATION_KEY)
// Payload Ploomes: { Action, Entity, Old, New, ... }
//   Action: "Win" | "Update" | "Create" | "Delete" | "Lose"
//   Entity: "Deal"
//   New.Id: número do deal afetado
//
// Comportamento por action:
//   Win    → sync do deal específico (fechou como ganho)
//   Update → sync do deal específico (dados atualizados)
//   Create → ignorado (deal ainda não ganho)
//   outros → ignorado

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { syncDeals } from '@/lib/ploomes/sync'

const VALIDATION_KEY = process.env.PLOOMES_VALIDATION_KEY ?? ''

// ── Tipos do payload de webhook Ploomes ──────────────────────

type PloomesWebhookPayload = {
  Action?: string     // "Win" | "Update" | "Create" | "Delete" | "Lose"
  Entity?: string     // "Deal" | "Contact" | etc.
  New?: { Id?: number; [key: string]: unknown }
  Old?: { Id?: number; [key: string]: unknown }
  // Variante legada — alguns webhooks enviam Id direto
  Id?: number
  DealId?: number
}

// ── Handler ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── 1. Validar chave de verificação ──────────────────────
    const receivedKey = req.headers.get('x-ploomes-validation-key') ?? ''

    if (VALIDATION_KEY && receivedKey !== VALIDATION_KEY) {
      console.warn('[Ploomes webhook] Chave de validação inválida.')
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    // ── 2. Ler payload ────────────────────────────────────────
    const payload = await req.json().catch(() => null) as PloomesWebhookPayload | null
    console.info('[Ploomes webhook] Payload recebido:', JSON.stringify(payload))

    const action = payload?.Action?.trim() ?? ''
    const entity = payload?.Entity?.trim() ?? ''

    // ── 3. Filtrar por entidade e ação ────────────────────────
    // Só processa eventos de Deal
    if (entity && entity !== 'Deal') {
      console.info(`[Ploomes webhook] Entidade ignorada: ${entity}`)
      return NextResponse.json({ received: true, action, skipped: true })
    }

    // Ações que disparam sync
    const SYNC_ACTIONS = ['Win', 'Update']

    if (action && !SYNC_ACTIONS.includes(action)) {
      console.info(`[Ploomes webhook] Ação ignorada: ${action}`)
      return NextResponse.json({ received: true, action, skipped: true })
    }

    // ── 4. Extrair deal ID ────────────────────────────────────
    const dealId: number | undefined =
      payload?.New?.Id ??
      payload?.Old?.Id ??
      payload?.Id ??
      payload?.DealId

    console.info(`[Ploomes webhook] Processando: action=${action || 'desconhecida'}, dealId=${dealId ?? 'todos'}`)

    // ── 5. Disparar sync ──────────────────────────────────────
    const supabase = await createAdminClient()

    const result = await syncDeals(supabase, {
      triggeredBy: 'webhook',
      triggeredByUserId: null,
      unitId: null, // sync global — webhook não tem contexto de unidade
    })

    console.info(`[Ploomes webhook] Sync concluído (dealId=${dealId ?? 'todos'}).`, result)

    return NextResponse.json({ received: true, action, dealId, result })
  } catch (err) {
    console.error('[POST /api/webhooks/ploomes]', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
