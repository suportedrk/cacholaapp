// POST /api/ploomes/webhook-register — Registra os webhooks no Ploomes CRM
//
// A API do Ploomes requer um registro separado por ação (ActionId).
// Registramos 3 webhooks: Win (ActionId=4) + Update (ActionId=2) + Lose (ActionId=5).
//
// Campos corretos da API (descobertos via GET /Webhooks):
//   CallbackUrl  (não "Url")
//   EntityId: 2  (Deal — não "EntityName")
//   ActionId: N  (não "Actions": [...])
//   Active: true (não "IsActive")
//   ValidationKey (opcional — enviado no header X-Ploomes-Validation-Key)
//
// Apenas super_admin pode executar.
// Body: { unit_id: string }

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { loadPloomesConfig } from '@/lib/ploomes/sync'

const APP_URL      = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const PLOOMES_API  = 'https://api2.ploomes.com'

// EntityId e ActionId confirmados via GET /Webhooks + GET /Webhooks@Actions
const DEAL_ENTITY_ID   = 2   // Deal
const ACTION_UPDATE_ID = 2   // Update
const ACTION_WIN_ID    = 4   // Win  (ganhou negócio)
const ACTION_LOSE_ID   = 5   // Lose (perdeu negócio)

// ── Tipos da API Ploomes ──────────────────────────────────────

type PloomesWebhook = {
  Id: number
  EntityId: number
  ActionId: number
  CallbackUrl: string
  Active: boolean
  ValidationKey: string | null
}

type PloomesODataResponse<T> = {
  value: T[]
}

// ── Helper HTTP ───────────────────────────────────────────────

async function ploomesFetch<T>(path: string, userKey: string, options: RequestInit = {}): Promise<T> {
  if (!userKey) throw new Error('Chave de API do Ploomes não configurada.')

  const res = await fetch(`${PLOOMES_API}/${path}`, {
    ...options,
    headers: {
      'User-Key': userKey,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Ploomes API ${res.status}: ${text}`)
  }

  return res.json() as Promise<T>
}

/** Garante que um webhook com EntityId+ActionId+CallbackUrl esteja registrado e ativo. */
async function ensureWebhook(
  userKey: string,
  webhookUrl: string,
  actionId: number,
  validationKey: string | null,
): Promise<{ id: number; created: boolean }> {
  // Verificar se já existe para essa URL + ação
  const existing = await ploomesFetch<PloomesODataResponse<PloomesWebhook>>(
    `Webhooks?$filter=CallbackUrl eq '${encodeURIComponent(webhookUrl)}' and ActionId eq ${actionId} and EntityId eq ${DEAL_ENTITY_ID}`,
    userKey,
  )

  const found = existing.value.find((w) => w.Active)
  if (found) {
    console.info(`[webhook-register] Webhook já ativo: Id=${found.Id}, ActionId=${actionId}`)
    return { id: found.Id, created: false }
  }

  // Criar novo webhook
  const created = await ploomesFetch<PloomesWebhook>('Webhooks', userKey, {
    method: 'POST',
    body: JSON.stringify({
      CallbackUrl: webhookUrl,
      EntityId: DEAL_ENTITY_ID,
      ActionId: actionId,
      Active: true,
      ...(validationKey ? { ValidationKey: validationKey } : {}),
    }),
  })

  console.info(`[webhook-register] Webhook criado: Id=${created.Id}, ActionId=${actionId}`)
  return { id: created.Id, created: true }
}

// ── Handler ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Apenas super_admin
  const supabaseUser = await createClient()
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: profile } = await supabaseUser
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Apenas super_admin pode registrar webhooks.' }, { status: 403 })
  }

  const body = await req.json().catch(() => null) as { unit_id?: string } | null
  const unitId = body?.unit_id

  if (!unitId) {
    return NextResponse.json({ error: 'unit_id obrigatório.' }, { status: 400 })
  }

  const webhookUrl = `${APP_URL}/api/webhooks/ploomes`
  const validationKey = process.env.PLOOMES_VALIDATION_KEY || null

  try {
    const supabase = await createAdminClient()
    const dbConfig = await loadPloomesConfig(supabase, unitId)
    const userKey = dbConfig?.user_key || process.env.PLOOMES_USER_KEY || ''

    // Registrar um webhook para cada ação (API exige um por ActionId)
    const [winResult, updateResult, loseResult] = await Promise.all([
      ensureWebhook(userKey, webhookUrl, ACTION_WIN_ID,    validationKey),
      ensureWebhook(userKey, webhookUrl, ACTION_UPDATE_ID, validationKey),
      ensureWebhook(userKey, webhookUrl, ACTION_LOSE_ID,   validationKey),
    ])

    // Persistir em ploomes_config
    const { error: updateError } = await supabase
      .from('ploomes_config')
      .update({
        webhook_url: webhookUrl,
        webhook_registered_at: new Date().toISOString(),
      })
      .eq('unit_id', unitId)

    if (updateError) {
      console.error('[webhook-register] Erro ao salvar no banco:', updateError)
      return NextResponse.json(
        { error: 'Webhooks registrados no Ploomes, mas falha ao salvar no banco.' },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      webhookUrl,
      win:    winResult,
      update: updateResult,
      lose:   loseResult,
      message: `Webhooks registrados com sucesso. Win: #${winResult.id} · Update: #${updateResult.id} · Lose: #${loseResult.id}`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/ploomes/webhook-register]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
